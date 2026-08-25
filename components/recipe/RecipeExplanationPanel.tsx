"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { explainRecipeAction } from "@/app/actions/explain-recipe";
import type { RecipeExplanation } from "@/types/explanation";

export function RecipeExplanationPanel({
  recipe,
}: {
  recipe: {
    title: string;
    ingredients: string[];
    steps: { number: number; step: string }[];
  };
}) {
  const [explanation, setExplanation] = useState<RecipeExplanation | null>(
    null,
  );
  const [showBeginner, setShowBeginner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleExplain = () => {
    setError(null);
    startTransition(async () => {
      const result = await explainRecipeAction(recipe);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setExplanation(result.explanation);
    });
  };

  if (!explanation) {
    return (
      <div>
        <Button variant="outline" onClick={handleExplain} disabled={isPending}>
          <Sparkles className="size-4" />
          {isPending ? "Reading the recipe..." : "Explain This Recipe"}
        </Button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Before you start
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {explanation.summary}
          </p>
        </div>

        {explanation.ingredientNotes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Unfamiliar ingredients
            </h4>
            <ul className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {explanation.ingredientNotes.map((n) => (
                <li key={n.name}>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {n.name}:
                  </span>{" "}
                  {n.explanation}
                </li>
              ))}
            </ul>
          </div>
        )}

        {explanation.stepTips.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Step tips
            </h4>
            <ul className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {explanation.stepTips.map((t) => (
                <li key={t.stepNumber}>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    Step {t.stepNumber}:
                  </span>{" "}
                  {t.tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {explanation.beginnerVersion && (
          <div>
            <button
              onClick={() => setShowBeginner((s) => !s)}
              className="text-sm font-semibold text-orange-600 hover:underline"
            >
              {showBeginner ? "Hide" : "Show"} beginner-friendly instructions
            </button>
            {showBeginner && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {explanation.beginnerVersion}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
