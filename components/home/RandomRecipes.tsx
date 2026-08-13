import { getRandomRecipes } from "@/lib/spoonacular";
import RecipeCard from "@/components/RecipeCard";

export default async function RandomRecipes() {
  const { recipes } = await getRandomRecipes(8);

  return (
    <section className="bg-zinc-50 px-6 py-16 dark:bg-zinc-900/40">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Feeling adventurous?
        </h2>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          A fresh batch of random recipes every visit
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </section>
  );
}
