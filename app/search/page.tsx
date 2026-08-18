import { Suspense } from "react";
import { searchRecipes } from "@/lib/spoonacular";
import { CUISINES, DIETS, MEAL_TYPES } from "@/lib/constant";
import RecipeCard from "@/components/RecipeCard";
import { AiSearchBar } from "@/components/search/AiSearchBar";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 12;

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function SearchResults({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const query = first(searchParams.query) ?? "";
  const cuisine = first(searchParams.cuisine) ?? "";
  const diet = first(searchParams.diet) ?? "";
  const type = first(searchParams.type) ?? "";
  const maxReadyTime = first(searchParams.maxReadyTime);
  const maxCalories = first(searchParams.maxCalories);
  const minProtein = first(searchParams.minProtein);
  const offset = Number(first(searchParams.offset) ?? "0") || 0;

  const { results, totalResults } = await searchRecipes(
    {
      query: query || undefined,
      cuisine: cuisine || undefined,
      diet: diet || undefined,
      type: type || undefined,
      maxReadyTime: maxReadyTime ? Number(maxReadyTime) : undefined,
      maxCalories: maxCalories ? Number(maxCalories) : undefined,
      minProtein: minProtein ? Number(minProtein) : undefined,
    },
    offset,
    PAGE_SIZE,
  );

  const buildPageUrl = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (cuisine) params.set("cuisine", cuisine);
    if (diet) params.set("diet", diet);
    if (type) params.set("type", type);
    if (maxReadyTime) params.set("maxReadyTime", maxReadyTime);
    if (maxCalories) params.set("maxCalories", maxCalories);
    if (minProtein) params.set("minProtein", minProtein);
    params.set("offset", String(nextOffset));
    return `/search?${params.toString()}`;
  };

  if (results.length === 0) {
    return (
      <p className="mt-10 text-center text-zinc-500 dark:text-zinc-400">
        No recipes found. Try loosening a filter.
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {totalResults} results
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
      <div className="mt-10 flex justify-center gap-3">
        {offset > 0 && (
          <Button variant="outline">
            <a href={buildPageUrl(Math.max(0, offset - PAGE_SIZE))}>Previous</a>
          </Button>
        )}
        {offset + PAGE_SIZE < totalResults && (
          <Button variant="outline">
            <a href={buildPageUrl(offset + PAGE_SIZE)}>Next</a>
          </Button>
        )}
      </div>
    </>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams;
  const query = first(resolvedParams.query) ?? "";
  const cuisine = first(resolvedParams.cuisine) ?? "";
  const diet = first(resolvedParams.diet) ?? "";
  const type = first(resolvedParams.type) ?? "";
  const maxReadyTime = first(resolvedParams.maxReadyTime) ?? "";
  const maxCalories = first(resolvedParams.maxCalories) ?? "";
  const minProtein = first(resolvedParams.minProtein) ?? "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Search recipes
      </h1>

      <div className="mt-6">
        <AiSearchBar />
      </div>

      <form
        action="/search"
        method="GET"
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <input
          type="text"
          name="query"
          defaultValue={query}
          placeholder="Search by name or ingredient..."
          className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-3 lg:col-span-2"
        />
        <select
          name="cuisine"
          defaultValue={cuisine}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Any cuisine</option>
          {CUISINES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="diet"
          defaultValue={diet}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Any diet</option>
          {DIETS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={type}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm capitalize dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Any meal type</option>
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="maxReadyTime"
          defaultValue={maxReadyTime}
          placeholder="Max minutes"
          min={1}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          name="maxCalories"
          defaultValue={maxCalories}
          placeholder="Max calories"
          min={1}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          name="minProtein"
          defaultValue={minProtein}
          placeholder="Min protein (g)"
          min={1}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" className="col-span-2 sm:col-span-1">
          Search
        </Button>
      </form>

      <Suspense
        key={JSON.stringify(resolvedParams)}
        fallback={<p className="mt-10 text-zinc-500">Loading...</p>}
      >
        <SearchResults searchParams={resolvedParams} />
      </Suspense>
    </main>
  );
}
