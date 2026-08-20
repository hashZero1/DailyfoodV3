"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { searchRecipes, getRecipeById, extractMacros } from "@/lib/spoonacular";
import { generateMealPlan } from "@/lib/gemini";
import { addMealPlanEntry, listMealPlanEntries } from "@/lib/mealplan";
import { listPantryItems } from "@/lib/pantry";
import type { MealType } from "@/types/mealplan";

export interface AiMealPlanConstraints {
  weekStart: string; // ISO date, Monday
  dailyCalories?: number;
  diet?: string;
  intolerances?: string;
  maxReadyTime?: number;
  usePantry: boolean;
}

export type GenerateAiMealPlanResult =
  | { ok: true; entriesCreated: number; skippedFilledSlots: number }
  | {
      ok: false;
      reason: "unauthenticated" | "no_candidates" | "error";
      message?: string;
    };

function addDaysISO(startISO: string, days: number): string {
  const d = new Date(`${startISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function generateAiMealPlanAction(
  constraints: AiMealPlanConstraints
): Promise<GenerateAiMealPlanResult> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { ok: false, reason: "unauthenticated" };
  }
  const userId = session.user.sub;

  try {
    // Push the calorie target into Spoonacular's own filtering rather than
    // asking the model to reason about nutrition math over a candidate
    // list — the candidates are already roughly on-target before Gemini
    // ever sees them.
    const perMealCalories = constraints.dailyCalories
      ? Math.round(constraints.dailyCalories / 3)
      : undefined;

    const [breakfastResult, mainResult] = await Promise.all([
      searchRecipes(
        {
          type: "breakfast",
          diet: constraints.diet,
          intolerances: constraints.intolerances,
          maxReadyTime: constraints.maxReadyTime,
          maxCalories: perMealCalories
            ? Math.round(perMealCalories * 1.3)
            : undefined,
        },
        0,
        12
      ),
      searchRecipes(
        {
          type: "main course",
          diet: constraints.diet,
          intolerances: constraints.intolerances,
          maxReadyTime: constraints.maxReadyTime,
          maxCalories: perMealCalories
            ? Math.round(perMealCalories * 1.3)
            : undefined,
        },
        0,
        24
      ),
    ]);

    const breakfastCandidates = breakfastResult.results.map((r) => ({
      id: r.id,
      title: r.title,
      readyInMinutes: r.readyInMinutes,
    }));
    const mainCandidates = mainResult.results.map((r) => ({
      id: r.id,
      title: r.title,
      readyInMinutes: r.readyInMinutes,
    }));

    if (breakfastCandidates.length === 0 || mainCandidates.length === 0) {
      return {
        ok: false,
        reason: "no_candidates",
        message:
          "Not enough recipes matched those constraints — try loosening the diet, time, or calorie limit.",
      };
    }

    let pantryIngredients: string[] = [];
    if (constraints.usePantry) {
      const items = await listPantryItems(userId);
      pantryIngredients = items.map((i) => i.name);
    }

    const notes = [
      constraints.dailyCalories
        ? `Target roughly ${constraints.dailyCalories} calories per day across the 3 meals.`
        : "",
      constraints.diet ? `Diet: ${constraints.diet}.` : "",
      constraints.intolerances ? `Avoid: ${constraints.intolerances}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const slots = await generateMealPlan({
      breakfastCandidates,
      mainCandidates,
      pantryIngredients,
      notes,
    });

    const validBreakfastIds = new Set(breakfastCandidates.map((c) => c.id));
    const validMainIds = new Set(mainCandidates.map((c) => c.id));

    // Don't clobber meals the user already planned manually — only fill
    // empty slots.
    const weekEnd = addDaysISO(constraints.weekStart, 6);
    const existing = await listMealPlanEntries(
      userId,
      constraints.weekStart,
      weekEnd
    );
    const filledSlots = new Set(existing.map((e) => `${e.date}|${e.meal_type}`));

    let entriesCreated = 0;
    let skippedFilledSlots = 0;

    for (const slot of slots) {
      const mealType = slot.mealType as MealType;
      if (!["breakfast", "lunch", "dinner"].includes(mealType)) continue;
      if (slot.day < 0 || slot.day > 6) continue;

      const isBreakfast = mealType === "breakfast";
      const validIds = isBreakfast ? validBreakfastIds : validMainIds;
      if (!validIds.has(slot.recipeId)) continue; // guard against a hallucinated id

      const date = addDaysISO(constraints.weekStart, slot.day);
      const key = `${date}|${mealType}`;
      if (filledSlots.has(key)) {
        skippedFilledSlots++;
        continue;
      }

      const full = await getRecipeById(slot.recipeId).catch(() => null);
      if (!full) continue;
      const macros = extractMacros(full);

      await addMealPlanEntry(userId, {
        date,
        mealType,
        recipeId: full.id,
        title: full.title,
        image: full.image,
        ...macros,
      });
      filledSlots.add(key); // guard against Gemini assigning the same slot twice
      entriesCreated++;
    }

    revalidatePath("/meal-plan");
    return { ok: true, entriesCreated, skippedFilledSlots };
  } catch (error) {
    console.error("generateAiMealPlanAction failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}
