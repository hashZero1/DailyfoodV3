"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIETS } from "@/lib/constants";
import { generateAiMealPlanAction } from "@/app/actions/ai-mealplan";

export function GenerateAiPlanButton({ weekStart }: { weekStart: string }) {
  const [open, setOpen] = useState(false);
  const [dailyCalories, setDailyCalories] = useState("");
  const [diet, setDiet] = useState("");
  const [intolerances, setIntolerances] = useState("");
  const [maxReadyTime, setMaxReadyTime] = useState("");
  const [usePantry, setUsePantry] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAiMealPlanAction({
        weekStart,
        dailyCalories: dailyCalories ? Number(dailyCalories) : undefined,
        diet: diet || undefined,
        intolerances: intolerances || undefined,
        maxReadyTime: maxReadyTime ? Number(maxReadyTime) : undefined,
        usePantry,
      });

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          toast("Log in to generate a meal plan", {
            action: {
              label: "Log in",
              onClick: () => (window.location.href = "/auth/login"),
            },
          });
        } else {
          toast.error(result.message ?? "Couldn't generate a plan. Try again.");
        }
        return;
      }

      const skippedNote =
        result.skippedFilledSlots > 0
          ? ` (${result.skippedFilledSlots} slot${result.skippedFilledSlots === 1 ? "" : "s"} already had a meal planned, left as-is)`
          : "";
      toast(`Filled in ${result.entriesCreated} meals for this week${skippedNote}`);
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Generate AI Meal Plan
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="number"
          placeholder="Daily calories"
          value={dailyCalories}
          onChange={(e) => setDailyCalories(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Any diet</option>
          {DIETS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Avoid (e.g. shellfish)"
          value={intolerances}
          onChange={(e) => setIntolerances(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          placeholder="Max min/meal"
          value={maxReadyTime}
          onChange={(e) => setMaxReadyTime(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={usePantry}
          onChange={(e) => setUsePantry(e.target.checked)}
        />
        Prefer recipes using my pantry ingredients
      </label>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating your week..." : "Generate"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Only fills in empty slots — meals you&apos;ve already planned this
        week are left untouched.
      </p>
    </div>
  );
}
