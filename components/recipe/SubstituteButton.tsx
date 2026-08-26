"use client";

import { useState, useTransition } from "react";
import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSubstitutesAction } from "@/app/actions/substitution";
import type { IngredientSubstitution } from "@/types/substitution";

export function SubstituteButton({
  ingredientName,
  recipeTitle,
}: {
  ingredientName: string;
  recipeTitle: string;
}) {
  const [subs, setSubs] = useState<IngredientSubstitution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await getSubstitutesAction(ingredientName, recipeTitle);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSubs(result.substitutions);
    });
  };

  if (subs) {
    return (
      <ul className="mt-1 ml-4 space-y-1 border-l border-zinc-200 pl-3 text-xs dark:border-zinc-800">
        {subs.length === 0 ? (
          <li className="text-zinc-400">No good substitutes found.</li>
        ) : (
          subs.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {s.name}
              </span>{" "}
              <span className="text-zinc-500 dark:text-zinc-400">
                — {s.tasteTextureChange}
              </span>
              {s.materiallyChanges && (
                <Badge
                  variant="destructive"
                  className="ml-1 align-middle text-[10px]"
                >
                  changes the dish
                </Badge>
              )}
              {s.source === "ai" && (
                <span className="ml-1 text-zinc-400">(AI-suggested)</span>
              )}
            </li>
          ))
        )}
      </ul>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center align-middle">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-0.5 text-xs text-orange-600 hover:underline"
      >
        <Repeat className="size-3" />
        {isPending ? "Looking..." : "Substitute?"}
      </button>
      {error && <span className="ml-2 text-xs text-red-500">{error}</span>}
    </span>
  );
}
