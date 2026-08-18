import "server-only";
import type {
  RecipeDetail,
  RecipeSummary,
  SearchFilters,
  SearchResult,
} from "@/types/recipe";
import type { FridgeMatchRecipe } from "@/types/fridge";

// "server-only" makes it a build error to accidentally import this file
// from a Client Component — the API key must never reach the browser.

const BASE_URL = "https://api.spoonacular.com";

function getApiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) {
    throw new Error(
      "SPOONACULAR_API_KEY is not set. Add it to .env.local (see .env.local.example).",
    );
  }
  return key;
}

async function spoonacularFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
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
      body?.message || `Spoonacular request failed (${res.status})`,
    );
  }

  return res.json() as Promise<T>;
}

export async function getRandomRecipes(
  number = 10,
): Promise<{ recipes: RecipeSummary[] }> {
  return spoonacularFetch("/recipes/random", { number });
}

export async function searchRecipes(
  filters: SearchFilters,
  offset = 0,
  number = 12,
): Promise<SearchResult> {
  return spoonacularFetch("/recipes/complexSearch", {
    query: filters.query,
    cuisine: filters.cuisine,
    diet: filters.diet,
    intolerances: filters.intolerances,
    maxReadyTime: filters.maxReadyTime,
    type: filters.type,
    maxCalories: filters.maxCalories,
    minProtein: filters.minProtein,
    addRecipeInformation: true,
    offset,
    number,
  });
}

export async function getTrendingRecipes(
  number = 8,
): Promise<{ results: RecipeSummary[] }> {
  // Spoonacular's own popularity ranking (aggregateLikes), so "Trending"
  // is real signal rather than a static hardcoded list of recipe IDs.
  return spoonacularFetch("/recipes/complexSearch", {
    sort: "popularity",
    number,
    addRecipeInformation: true,
  });
}

interface RawIngredientMatch {
  id: number;
  name: string;
  image?: string;
}

interface RawFindByIngredientsResult {
  id: number;
  title: string;
  image?: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: RawIngredientMatch[];
}

export async function findRecipesByIngredients(
  ingredients: string[],
  number = 20,
): Promise<FridgeMatchRecipe[]> {
  if (ingredients.length === 0) return [];

  const raw = await spoonacularFetch<RawFindByIngredientsResult[]>(
    "/recipes/findByIngredients",
    {
      ingredients: ingredients.join(","),
      number,
      ranking: 1, // maximize used ingredients over minimizing missing
      ignorePantry: true,
    },
  );

  // Spoonacular gives raw used/missed counts — we compute our own match
  // percentage from them rather than relying on their ranking alone,
  // per the roadmap's "rank results using your own match score" note.
  return raw.map((r) => {
    const total = r.usedIngredientCount + r.missedIngredientCount;
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      usedIngredientCount: r.usedIngredientCount,
      missedIngredientCount: r.missedIngredientCount,
      missedIngredients: r.missedIngredients.map((mi) => ({
        id: mi.id,
        name: mi.name,
        image: mi.image,
      })),
      matchPercent:
        total > 0 ? Math.round((r.usedIngredientCount / total) * 100) : 0,
    };
  });
}

export function extractMacros(recipe: RecipeDetail): {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
} {
  const nutrients = recipe.nutrition?.nutrients ?? [];
  const find = (name: string) =>
    nutrients.find((n) => n.name === name)?.amount ?? null;

  return {
    calories: find("Calories"),
    proteinG: find("Protein"),
    carbsG: find("Carbohydrates"),
    fatG: find("Fat"),
  };
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
