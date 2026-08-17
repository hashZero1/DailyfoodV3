"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { removeMealPlanEntryAction } from "@/app/actions/mealplan";
import type { MealPlanEntryRecord, MealType } from "@/types/mealplan";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function MealPlanGrid({
  days,
  entries: initialEntries,
}: {
  days: string[]; // 7 ISO dates
  entries: MealPlanEntryRecord[];
}) {
  const [entries, setEntries] = useState(initialEntries);

  const remove = async (id: string) => {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id)); // optimistic
    const result = await removeMealPlanEntryAction(id);
    if (!result.ok) {
      setEntries(prev); // revert
      toast.error("Couldn't remove that meal.");
    }
  };

  const entriesFor = (date: string, mealType: MealType) =>
    entries.filter((e) => e.date === date && e.meal_type === mealType);

  const totalsFor = (date: string) =>
    entries
      .filter((e) => e.date === date)
      .reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories ?? 0),
          protein: acc.protein + (e.protein_g ?? 0),
          carbs: acc.carbs + (e.carbs_g ?? 0),
          fat: acc.fat + (e.fat_g ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[880px] grid-cols-[90px_repeat(7,1fr)] gap-2">
        <div />
        {days.map((date) => (
          <div
            key={date}
            className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {formatDayLabel(date)}
          </div>
        ))}

        {MEAL_ORDER.map((mealType) => (
          <Fragment key={mealType}>
            <div className="flex items-center py-2 text-sm font-medium capitalize text-zinc-500 dark:text-zinc-400">
              {mealType}
            </div>
            {days.map((date) => (
              <div
                key={`${date}-${mealType}`}
                className="min-h-[64px] rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800"
              >
                {entriesFor(date, mealType).map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-1 flex items-start justify-between gap-1 rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                  >
                    <span className="line-clamp-2">{entry.title}</span>
                    <button
                      onClick={() => remove(entry.id)}
                      aria-label="Remove meal"
                      className="shrink-0"
                    >
                      <Trash2 className="size-3 text-zinc-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}

        <div className="py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Totals
        </div>
        {days.map((date) => {
          const t = totalsFor(date);
          return (
            <div
              key={`${date}-totals`}
              className="rounded-lg bg-zinc-50 p-2 text-center text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {Math.round(t.calories)} kcal
              <br />P{Math.round(t.protein)} C{Math.round(t.carbs)} F
              {Math.round(t.fat)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
