"use server";

import { explainRecipe } from "@/lib/gemini";
import type { RecipeExplanation } from "@/types/explanation";

export type ExplainRecipeResult =
  | { ok: true; explanation: RecipeExplanation }
  | { ok: false; message: string };

export async function explainRecipeAction(recipe: {
  title: string;
  ingredients: string[];
  steps: { number: number; step: string }[];
}): Promise<ExplainRecipeResult> {
  try {
    const explanation = await explainRecipe(recipe);
    return { ok: true, explanation };
  } catch (error) {
    console.error("explainRecipeAction failed:", error);
    return {
      ok: false,
      message: "Couldn't put that together right now. Try again.",
    };
  }
}
