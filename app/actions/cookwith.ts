"use server";

import { normalizeIngredients, explainMissingIngredients } from "@/lib/gemini";
import { findRecipesByIngredients } from "@/lib/spoonacular";
import type { FridgeMatchRecipe } from "@/types/fridge";
import type { MissingIngredientExplanation } from "@/types/cookwith";

export type NormalizeResult =
  | { ok: true; ingredients: string[] }
  | { ok: false; message: string };

export async function normalizeIngredientsAction(
  description: string,
): Promise<NormalizeResult> {
  const trimmed = description.trim();
  if (!trimmed) {
    return { ok: false, message: "Describe what you have first." };
  }

  try {
    const ingredients = await normalizeIngredients(trimmed);
    if (ingredients.length === 0) {
      return {
        ok: false,
        message: "Couldn't pick out any ingredients — try being more specific.",
      };
    }
    return { ok: true, ingredients };
  } catch (error) {
    console.error("normalizeIngredientsAction failed:", error);
    return {
      ok: false,
      message: "Something went wrong understanding that. Try again.",
    };
  }
}

export async function matchRecipesAction(
  ingredients: string[],
): Promise<FridgeMatchRecipe[]> {
  return findRecipesByIngredients(ingredients, 12);
}

export type ExplainResult =
  | { ok: true; explanations: MissingIngredientExplanation[] }
  | { ok: false; message: string };

export async function explainMissingAction(
  recipeTitle: string,
  missingIngredients: string[],
): Promise<ExplainResult> {
  try {
    const explanations = await explainMissingIngredients(
      recipeTitle,
      missingIngredients,
    );
    return { ok: true, explanations };
  } catch (error) {
    console.error("explainMissingAction failed:", error);
    return { ok: false, message: "Couldn't get suggestions right now." };
  }
}
