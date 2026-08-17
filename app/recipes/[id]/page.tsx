import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AddToMealPlanButton } from "@/components/mealplan/AddToMealPlanButton";
import { RecipeImage } from "@/components/RecipeImage";
import { getRecipeById } from "@/lib/spoonacular";
import { isFavorited } from "@/lib/favorites";
import { auth0 } from "@/lib/auth0";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipeId = Number(id);

  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    notFound();
  }

  const [recipe, session] = await Promise.all([
    getRecipeById(recipeId).catch(() => null),
    auth0.getSession(),
  ]);

  if (!recipe) {
    notFound();
  }

  const favorited = session?.user?.sub
    ? await isFavorited(session.user.sub, recipeId)
    : false;

  const steps = recipe.analyzedInstructions?.[0]?.steps ?? [];
  const tags = [
    ...(recipe.cuisines ?? []),
    ...(recipe.dishTypes ?? []),
    ...(recipe.diets ?? []),
  ].slice(0, 8);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          <RecipeImage
            src={recipe.image}
            alt={recipe.title}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {recipe.title}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="capitalize">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            {recipe.servings && <span>{recipe.servings} servings</span>}
            {recipe.readyInMinutes && <span>{recipe.readyInMinutes} min</span>}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <FavoriteButton
              recipe={{
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
              }}
              initialFavorited={favorited}
            />
            <AddToMealPlanButton
              recipe={{
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
              }}
            />
          </div>
        </div>
      </div>

      {recipe.summary && (
        <div
          className="mt-10 leading-relaxed text-zinc-700 dark:text-zinc-300 [&_a]:text-orange-600 [&_a]:underline [&_b]:font-semibold"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(recipe.summary),
          }}
        />
      )}

      {recipe.extendedIngredients && recipe.extendedIngredients.length > 0 && (
        <>
          <Separator className="my-8" />
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Ingredients
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {recipe.extendedIngredients.map((ingredient) => (
                  <li
                    key={ingredient.id}
                    className="text-zinc-700 dark:text-zinc-300"
                  >
                    {ingredient.original}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <Separator className="my-8" />

      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Instructions
        </h2>
        {steps.length > 0 ? (
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-zinc-700 dark:text-zinc-300">
            {steps.map((step) => (
              <li key={step.number}>{step.step}</li>
            ))}
          </ol>
        ) : recipe.instructions ? (
          <div
            className="mt-4 leading-relaxed text-zinc-700 dark:text-zinc-300 [&_a]:text-orange-600 [&_a]:underline [&_b]:font-semibold"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(recipe.instructions),
            }}
          />
        ) : (
          <p className="mt-4 text-zinc-500">Not available.</p>
        )}
      </div>
    </main>
  );
}
