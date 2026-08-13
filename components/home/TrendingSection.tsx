import { getTrendingRecipes } from "@/lib/spoonacular";
import RecipeCard from "@/components/RecipeCard";

export default async function TrendingSection() {
  const { results } = await getTrendingRecipes(8);

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Trending recipes
        </h2>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          What everyone&apos;s cooking right now
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </section>
  );
}
