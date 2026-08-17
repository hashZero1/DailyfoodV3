import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { listMealPlanEntries } from "@/lib/mealplan";
import { MealPlanGrid } from "@/components/mealplan/MealPlanGrid";
import { Button } from "@/components/ui/button";

function getWeekStart(dateStr?: string): Date {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const day = base.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, n: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function MealPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth0.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Log in to plan your meals
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Your meal plan is tied to your account.
        </p>
        <Button className="mt-6">
          <a href="/auth/login?returnTo=/meal-plan">Log in</a>
        </Button>
      </main>
    );
  }

  const { week } = await searchParams;
  const weekStart = getWeekStart(week);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) =>
    toISODate(addDays(weekStart, i)),
  );

  const entries = await listMealPlanEntries(
    session.user.sub,
    toISODate(weekStart),
    toISODate(weekEnd),
  );

  const prevWeekHref = `/meal-plan?week=${toISODate(addDays(weekStart, -7))}`;
  const nextWeekHref = `/meal-plan?week=${toISODate(addDays(weekStart, 7))}`;
  const thisWeekHref = `/meal-plan?week=${toISODate(getWeekStart())}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Meal Planner
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {toISODate(weekStart)} – {toISODate(weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Link href={prevWeekHref}>Previous</Link>
          </Button>
          <Button variant="outline" size="sm">
            <Link href={thisWeekHref}>This week</Link>
          </Button>
          <Button variant="outline" size="sm">
            <Link href={nextWeekHref}>Next</Link>
          </Button>
        </div>
      </div>

      {entries.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing planned this week yet — open any recipe and use &quot;Add to
          Meal Plan&quot; to fill it in.
        </p>
      )}

      <div className="mt-6">
        <MealPlanGrid days={days} entries={entries} />
      </div>
    </main>
  );
}
