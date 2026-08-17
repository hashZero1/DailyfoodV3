"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToMealPlanAction } from "@/app/actions/mealplan";
import type { MealType } from "@/types/mealplan";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddToMealPlanButton({
  recipe,
}: {
  recipe: { id: number; title: string; image?: string };
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      const result = await addToMealPlanAction(recipe, date, mealType);

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          toast("Log in to plan meals", {
            action: {
              label: "Log in",
              onClick: () => (window.location.href = "/auth/login"),
            },
          });
        } else {
          toast.error("Couldn't add to your meal plan. Try again.");
        }
        return;
      }

      toast(`Added to ${mealType} on ${date}`);
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" />
        Add to Meal Plan
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={mealType}
        onChange={(e) => setMealType(e.target.value as MealType)}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm capitalize dark:border-zinc-700 dark:bg-zinc-900"
      >
        {MEAL_TYPES.map((t) => (
          <option key={t} value={t} className="capitalize">
            {t}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={handleAdd} disabled={isPending}>
        {isPending ? "Adding..." : "Confirm"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
