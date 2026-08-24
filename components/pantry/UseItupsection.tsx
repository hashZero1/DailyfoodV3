import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/RecipeImage";
import { findRecipesByIngredients } from "@/lib/spoonacular";
import type { PantryItemRecord } from "@/types/pantry";

const EXPIRY_WINDOW_DAYS = 5;

function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export async function UseItUpSection({ items }: { items: PantryItemRecord[] }) {
  const expiringSoon = items.filter(
    (i) => i.expires_at && daysUntil(i.expires_at) <= EXPIRY_WINDOW_DAYS,
  );

  if (expiringSoon.length === 0) return null;

  const results = await findRecipesByIngredients(
    expiringSoon.map((i) => i.name),
    6,
  ).catch(() => []);

  if (results.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">
        Use it up — expiring soon
      </h2>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {expiringSoon.map((i) => (
          <Badge key={i.id} variant="secondary">
            {i.name}
          </Badge>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {results.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${recipe.id}`}
            className="overflow-hidden rounded-lg bg-white dark:bg-zinc-900"
          >
            <div className="relative aspect-square w-full">
              <RecipeImage
                src={recipe.image}
                alt={recipe.title}
                sizes="150px"
              />
            </div>
            <p className="line-clamp-2 p-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {recipe.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
