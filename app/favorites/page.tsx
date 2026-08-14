import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { listFavorites } from "@/lib/favorites";
import RecipeCard from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";

export default async function FavoritesPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Log in to see your favorites
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Saved recipes are tied to your account.
        </p>
        <Button asChild className="mt-6">
          <a href="/auth/login?returnTo=/favorites">Log in</a>
        </Button>
      </main>
    );
  }

  const favorites = await listFavorites(session.user.sub);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Your favorites
      </h1>

      {favorites.length === 0 ? (
        <p className="mt-6 text-zinc-500 dark:text-zinc-400">
          No favorites saved yet.{" "}
          <Link href="/search" className="text-orange-600 underline">
            Find a recipe
          </Link>{" "}
          to add one.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {favorites.map((favorite) => (
            <RecipeCard
              key={favorite.id}
              recipe={{
                id: favorite.recipe_id,
                title: favorite.title,
                image: favorite.image ?? undefined,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
