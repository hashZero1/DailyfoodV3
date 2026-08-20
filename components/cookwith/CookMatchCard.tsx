"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecipeImage } from "@/components/RecipeImage";
import { explainMissingAction } from "@/app/actions/cookwith";
import type { FridgeMatchRecipe } from "@/types/fridge";
import type { MissingIngredientExplanation } from "@/types/cookwith";

export function CookMatchCard({ recipe }: { recipe: FridgeMatchRecipe }) {
  const [explanations, setExplanations] = useState<
    MissingIngredientExplanation[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleExplain = () => {
    setError(null);
    startTransition(async () => {
      const result = await explainMissingAction(
        recipe.title,
        recipe.missedIngredients.map((i) => i.name)
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setExplanations(result.explanations);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
          <RecipeImage
            src={recipe.image}
            alt={recipe.title}
            sizes="(max-width: 768px) 100vw, 33vw"
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
        </div>
      </Link>

      {recipe.missedIngredients.length > 0 && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          {!explanations ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplain}
              disabled={isPending}
            >
              {isPending ? "Thinking..." : "Explain missing ingredients"}
            </Button>
          ) : (
            <ul className="space-y-2 text-sm">
              {explanations.map((e) => (
                <li key={e.name}>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {e.name}:
                  </span>{" "}
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {e.explanation}
                  </span>
                  {e.substitute && (
                    <span className="block text-xs text-orange-600">
                      Try instead: {e.substitute}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
