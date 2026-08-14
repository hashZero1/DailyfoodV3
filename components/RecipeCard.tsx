import Link from "next/link";
import { RecipeImage } from "@/components/RecipeImage";
import type { RecipeSummary } from "@/types/recipe";

export default function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <RecipeImage
          src={recipe.image}
          alt={recipe.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold text-zinc-900 dark:text-zinc-50">
          {recipe.title}
        </h3>
        {recipe.readyInMinutes && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {recipe.readyInMinutes} min
          </p>
        )}
      </div>
    </Link>
  );
}
