"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CookMatchCard } from "@/components/cookwith/CookMatchCard";
import {
  normalizeIngredientsAction,
  matchRecipesAction,
} from "@/app/actions/cookwith";
import type { FridgeMatchRecipe } from "@/types/fridge";

export function CookWithWhatIHave() {
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<string[] | null>(null);
  const [results, setResults] = useState<FridgeMatchRecipe[] | null>(null);
  const [isNormalizing, startNormalizing] = useTransition();
  const [isSearching, startSearching] = useTransition();

  const handleNormalize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    startNormalizing(async () => {
      const result = await normalizeIngredientsAction(description);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setIngredients(result.ingredients);
      setResults(null);
    });
  };

  const removeIngredient = (name: string) => {
    setIngredients((prev) => prev?.filter((i) => i !== name) ?? null);
  };

  const handleSearch = () => {
    if (!ingredients || ingredients.length === 0) return;
    startSearching(async () => {
      const matches = await matchRecipesAction(ingredients);
      setResults(matches);
    });
  };

  return (
    <div>
      <form
        onSubmit={handleNormalize}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. I have chicken breast, some rice, half an onion, and soy sauce"
          rows={3}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" disabled={isNormalizing} className="self-start">
          <Sparkles className="size-4" />
          {isNormalizing ? "Reading..." : "What can I make?"}
        </Button>
      </form>

      {ingredients && (
        <div className="mt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            I picked out these ingredients — remove any that aren&apos;t
            right:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ingredients.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 rounded-full border border-orange-600 bg-orange-50 px-3 py-1 text-sm text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
              >
                {name}
                <button
                  onClick={() => removeIngredient(name)}
                  aria-label={`Remove ${name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Button
            className="mt-3"
            size="sm"
            onClick={handleSearch}
            disabled={isSearching || ingredients.length === 0}
          >
            {isSearching ? "Searching..." : "Find Recipes"}
          </Button>
        </div>
      )}

      {results !== null && (
        <div className="mt-6">
          {results.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">
              No recipes matched those ingredients.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((recipe) => (
                <CookMatchCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
