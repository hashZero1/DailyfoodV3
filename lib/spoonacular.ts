import "server-only";
import type {
  RecipeDetail,
  RecipeSummary,
  SearchFilters,
  SearchResult,
} from "@/types/recipe";

// "server-only" makes it a build error to accidentally import this file
// from a Client Component — the API key must never reach the browser.

const BASE_URL = "https://api.spoonacular.com";

function getApiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) {
    throw new Error(
      "SPOONACULAR_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return key;
}

async function spoonacularFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("apiKey", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    // Cache random/search results briefly to reduce Spoonacular quota burn
    // (their free tier is point-limited). Adjust per-endpoint as needed.
    next: { revalidate: 60 * 10 },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.message || `Spoonacular request failed (${res.status})`
    );
  }

  return res.json() as Promise<T>;
}

export async function getRandomRecipes(
  number = 10
): Promise<{ recipes: RecipeSummary[] }> {
  return spoonacularFetch("/recipes/random", { number });
}

export async function searchRecipes(
  filters: SearchFilters,
  offset = 0,
  number = 12
): Promise<SearchResult> {
  return spoonacularFetch("/recipes/complexSearch", {
    query: filters.query,
    cuisine: filters.cuisine,
    diet: filters.diet,
    intolerances: filters.intolerances,
    maxReadyTime: filters.maxReadyTime,
    type: filters.type,
    addRecipeInformation: true,
    offset,
    number,
  });
}

export async function getTrendingRecipes(
  number = 8
): Promise<{ results: RecipeSummary[] }> {
  // Spoonacular's own popularity ranking (aggregateLikes), so "Trending"
  // is real signal rather than a static hardcoded list of recipe IDs.
  return spoonacularFetch("/recipes/complexSearch", {
    sort: "popularity",
    number,
    addRecipeInformation: true,
  });
}

export async function getRecipeById(id: number): Promise<RecipeDetail> {
  return spoonacularFetch(`/recipes/${id}/information`, {
    includeNutrition: true,
  });
}

export async function getRecipesBulk(ids: number[]): Promise<RecipeDetail[]> {
  if (ids.length === 0) return [];
  return spoonacularFetch("/recipes/informationBulk", {
    ids: ids.join(","),
  });
}
