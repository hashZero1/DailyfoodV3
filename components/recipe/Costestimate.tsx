import { IndianRupee } from "lucide-react";
import { estimateCostInINR } from "@/lib/gemini";
import type { RecipeDetail } from "@/types/recipe";

export async function CostEstimate({ recipe }: { recipe: RecipeDetail }) {
  const { estimatedINR } = await estimateCostInINR({
    title: recipe.title,
    pricePerServingUSDCents: recipe.pricePerServing ?? null,
    ingredients: (recipe.extendedIngredients ?? []).map((i) => i.name),
  }).catch(() => ({ estimatedINR: null as unknown as number }));

  if (!estimatedINR) return null;

  return (
    <span
      className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400"
      title="Approximate — AI-estimated, not live pricing"
    >
      <IndianRupee className="size-4" />
      ~₹{Math.round(estimatedINR)}/serving
    </span>
  );
}
