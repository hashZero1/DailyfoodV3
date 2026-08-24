"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeIngredient } from "@/types/recipe";

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
}

export function IngredientsList({
  ingredients,
  baseServings,
}: {
  ingredients: RecipeIngredient[];
  baseServings: number;
}) {
  const [servings, setServings] = useState(baseServings || 1);
  const scale = baseServings > 0 ? servings / baseServings : 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Ingredients
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Servings</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            aria-label="Decrease servings"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-6 text-center tabular-nums">{servings}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setServings((s) => s + 1)}
            aria-label="Increase servings"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ingredients.map((ingredient) => (
          <li key={ingredient.id} className="text-zinc-700 dark:text-zinc-300">
            {scale !== 1
              ? `${formatAmount(ingredient.amount * scale)} ${ingredient.unit} ${ingredient.name}`.trim()
              : ingredient.original}
          </li>
        ))}
      </ul>
      {scale !== 1 && (
        <p className="mt-2 text-xs text-zinc-400">
          Scaled from {baseServings} servings — approximate, rounded.
        </p>
      )}
    </div>
  );
}
