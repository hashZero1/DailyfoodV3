"use server";

import { getIngredientSubstitutes } from "@/lib/spoonacular";
import { explainSubstitutes } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/ratelimit";
import type { IngredientSubstitution } from "@/types/substitution";

export type SubstituteResult =
  | { ok: true; substitutions: IngredientSubstitution[] }
  | { ok: false; message: string };

export async function getSubstitutesAction(
  ingredientName: string,
  recipeTitle: string,
): Promise<SubstituteResult> {
  const rateLimit = await checkAiRateLimit();
  if (rateLimit.limited) {
    return { ok: false, message: rateLimit.message };
  }

  try {
    const { substitutes } = await getIngredientSubstitutes(ingredientName);
    const substitutions = await explainSubstitutes(
      ingredientName,
      recipeTitle,
      substitutes,
    );
    return { ok: true, substitutions };
  } catch (error) {
    console.error("getSubstitutesAction failed:", error);
    return {
      ok: false,
      message: "Couldn't find substitutes right now. Try again.",
    };
  }
}
