"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { addMealPlanEntry, deleteMealPlanEntry } from "@/lib/mealplan";
import { getRecipeById, extractMacros } from "@/lib/spoonacular";
import type { MealPlanEntryRecord, MealType } from "@/types/mealplan";

export type AddMealPlanResult =
  | { ok: true; entry: MealPlanEntryRecord }
  | { ok: false; reason: "unauthenticated" | "error"; message?: string };

export async function addToMealPlanAction(
  recipe: { id: number; title: string; image?: string },
  date: string,
  mealType: MealType,
): Promise<AddMealPlanResult> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    // Snapshot nutrition at add-time so the planner never has to re-hit
    // Spoonacular just to compute daily totals.
    const full = await getRecipeById(recipe.id).catch(() => null);
    const macros = full
      ? extractMacros(full)
      : { calories: null, proteinG: null, carbsG: null, fatG: null };

    const entry = await addMealPlanEntry(session.user.sub, {
      date,
      mealType,
      recipeId: recipe.id,
      title: recipe.title,
      image: recipe.image ?? null,
      ...macros,
    });

    revalidatePath("/meal-plan");
    return { ok: true, entry };
  } catch (error) {
    console.error("addToMealPlanAction failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}

export async function removeMealPlanEntryAction(
  entryId: string,
): Promise<{ ok: boolean }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return { ok: false };

  try {
    await deleteMealPlanEntry(session.user.sub, entryId);
    revalidatePath("/meal-plan");
    return { ok: true };
  } catch (error) {
    console.error("removeMealPlanEntryAction failed:", error);
    return { ok: false };
  }
}
