"use server";

import { findRecipesByIngredients } from "@/lib/spoonacular";
import type { FridgeMatchRecipe } from "@/types/fridge";

export async function matchFridgeRecipesAction(
  ingredients: string[],
  maxMissing?: number,
): Promise<FridgeMatchRecipe[]> {
  const results = await findRecipesByIngredients(ingredients, 24);

  if (maxMissing === undefined) return results;
  return results.filter((r) => r.missedIngredientCount <= maxMissing);
}
