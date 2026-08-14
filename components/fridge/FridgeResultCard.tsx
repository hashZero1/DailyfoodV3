import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/RecipeImage";
import type { FridgeMatchRecipe } from "@/types/fridge";

export function FridgeResultCard({ recipe }: { recipe: FridgeMatchRecipe }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
        <RecipeImage
          src={recipe.image}
          alt={recipe.title}
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover"
        />
        <Badge className="absolute top-2 right-2" variant="secondary">
          {recipe.matchPercent}% match
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold text-zinc-900 dark:text-zinc-50">
          {recipe.title}
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {recipe.usedIngredientCount} on hand
          {recipe.missedIngredientCount > 0 &&
            `, ${recipe.missedIngredientCount} missing`}
        </p>
        {recipe.missedIngredients.length > 0 && (
          <p className="mt-2 text-xs text-zinc-400">
            Missing: {recipe.missedIngredients.map((i) => i.name).join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}
