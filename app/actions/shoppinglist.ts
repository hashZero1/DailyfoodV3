"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import {
  addShoppingListItem,
  mergeIntoShoppingList,
  toggleShoppingListItem,
  deleteShoppingListItem,
  clearCheckedItems,
} from "@/lib/shoppinglist";
import { getRecipeById } from "@/lib/spoonacular";
import { listMealPlanEntries } from "@/lib/mealplan";

async function requireUserId(): Promise<string> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    throw new Error("You must be logged in.");
  }
  return session.user.sub;
}

export async function addManualItemAction(item: {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}) {
  const userId = await requireUserId();
  const created = await addShoppingListItem(userId, item);
  revalidatePath("/shopping-list");
  return created;
}

export async function toggleShoppingListItemAction(
  itemId: string,
  checked: boolean,
) {
  const userId = await requireUserId();
  await toggleShoppingListItem(userId, itemId, checked);
  revalidatePath("/shopping-list");
}

export async function deleteShoppingListItemAction(itemId: string) {
  const userId = await requireUserId();
  await deleteShoppingListItem(userId, itemId);
  revalidatePath("/shopping-list");
}

export async function clearCheckedItemsAction() {
  const userId = await requireUserId();
  await clearCheckedItems(userId);
  revalidatePath("/shopping-list");
}

export async function generateFromMealPlanAction(
  startDate: string,
  endDate: string,
): Promise<{ recipeCount: number; itemCount: number }> {
  const userId = await requireUserId();
  const entries = await listMealPlanEntries(userId, startDate, endDate);
  const uniqueRecipeIds = Array.from(new Set(entries.map((e) => e.recipe_id)));

  const allItems: {
    name: string;
    quantity: number | null;
    unit: string | null;
    source?: string | null;
  }[] = [];

  for (const recipeId of uniqueRecipeIds) {
    const entry = entries.find((e) => e.recipe_id === recipeId)!;
    const full = await getRecipeById(recipeId).catch(() => null);
    if (!full) continue;
    for (const ing of full.extendedIngredients ?? []) {
      allItems.push({
        name: ing.name,
        quantity: ing.amount ?? null,
        unit: ing.unit || null,
        source: entry.title,
      });
    }
  }

  await mergeIntoShoppingList(userId, allItems);
  revalidatePath("/shopping-list");
  return { recipeCount: uniqueRecipeIds.length, itemCount: allItems.length };
}

// Called from the public recipe detail page, so — unlike the actions
// above — this can't just throw on "not logged in": Next redacts thrown
// Server Action error messages in production, which would break the
// login-prompt UX. Same discriminated-result pattern as toggleFavoriteAction.
export type GenerateFromRecipeResult =
  | { ok: true; itemCount: number }
  | { ok: false; reason: "unauthenticated" | "error"; message?: string };

export async function generateFromRecipeAction(recipe: {
  id: number;
  title: string;
}): Promise<GenerateFromRecipeResult> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const full = await getRecipeById(recipe.id);
    const items = (full.extendedIngredients ?? []).map((ing) => ({
      name: ing.name,
      quantity: ing.amount ?? null,
      unit: ing.unit || null,
      source: recipe.title,
    }));
    await mergeIntoShoppingList(session.user.sub, items);
    revalidatePath("/shopping-list");
    return { ok: true, itemCount: items.length };
  } catch (error) {
    console.error("generateFromRecipeAction failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}
