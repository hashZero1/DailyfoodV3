"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FridgeResultCard } from "@/components/fridge/FridgeResultCard";
import { matchFridgeRecipesAction } from "@/app/actions/fridge";
import type { PantryItemRecord } from "@/types/pantry";
import type { FridgeMatchRecipe } from "@/types/fridge";

export function FridgeMatcher({
  pantryItems,
}: {
  pantryItems: PantryItemRecord[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pantryItems.map((i) => i.name)),
  );
  const [maxMissing, setMaxMissing] = useState<string>("");
  const [results, setResults] = useState<FridgeMatchRecipe[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, PantryItemRecord[]>();
    for (const item of pantryItems) {
      const key = item.category ?? "Other";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [pantryItems]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSearch = () => {
    if (selected.size === 0) {
      toast.error("Select at least one ingredient.");
      return;
    }
    startTransition(async () => {
      const matches = await matchFridgeRecipesAction(
        Array.from(selected),
        maxMissing ? Number(maxMissing) : undefined,
      );
      setResults(matches);
    });
  };

  return (
    <div>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {category}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {items.map((item) => {
                const isSelected = selected.has(item.name);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.name)}
                    aria-pressed={isSelected}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Max missing ingredients
          <input
            type="number"
            min={0}
            value={maxMissing}
            onChange={(e) => setMaxMissing(e.target.value)}
            placeholder="Any"
            className="w-20 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <Button onClick={handleSearch} disabled={isPending}>
          {isPending ? "Searching..." : "Find recipes"}
        </Button>
        <span className="text-sm text-zinc-500">
          {selected.size} of {pantryItems.length} selected
        </span>
      </div>

      {results !== null && (
        <div className="mt-8">
          {results.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">
              No recipes matched. Try selecting more ingredients or raising the
              missing-ingredient limit.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {results.map((recipe) => (
                <FridgeResultCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
