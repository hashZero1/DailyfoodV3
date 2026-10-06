import "server-only";
import type {
  CanonicalIngredient,
  CanonicalNutrients,
} from "@/types/nutrition";
import { EMPTY_NUTRIENTS } from "@/types/nutrition";

// "server-only" makes it a build error to accidentally import this file
// from a Client Component — same pattern as lib/spoonacular.ts.

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

function getApiKey(): string {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) {
    throw new Error(
      "USDA_FDC_API_KEY is not set. Get a free key at https://fdc.nal.usda.gov/api-key-signup and add it to .env.local.",
    );
  }
  return key;
}

async function usdaFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    // Static reference data (USDA foundation/legacy records rarely change)
    // — cache long, re-run the seed script to pick up a USDA revision
    // rather than relying on revalidation at request time.
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `USDA FDC request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// USDA FoodData Central nutrient numbers used to populate the canonical
// schema. These are stable reference IDs published by USDA
// (https://fdc.nal.usda.gov), not expected to change between data releases.
const NUTRIENT_ID_MAP: Record<keyof CanonicalNutrients, number> = {
  calories_kcal: 1008,
  protein_g: 1003,
  carbs_g: 1005,
  fiber_g: 1079,
  sugar_g: 2000,
  fat_g: 1004,
  saturated_fat_g: 1258,
  trans_fat_g: 1257,
  cholesterol_mg: 1253,
  sodium_mg: 1093,
  potassium_mg: 1092,
  calcium_mg: 1087,
  iron_mg: 1089,
  magnesium_mg: 1090,
  zinc_mg: 1095,
  phosphorus_mg: 1091,
  vitamin_a_mcg: 1106,
  vitamin_c_mg: 1162,
  vitamin_d_mcg: 1114,
  vitamin_e_mg: 1109,
  vitamin_k_mcg: 1185,
  vitamin_b12_mcg: 1178,
  folate_mcg: 1177,
  thiamin_mg: 1165,
  riboflavin_mg: 1166,
  niacin_mg: 1167,
  vitamin_b6_mg: 1175,
};

interface RawFdcNutrient {
  nutrient: { id: number; name: string; unitName: string };
  amount?: number;
}

interface RawFdcFood {
  fdcId: number;
  description: string;
  dataType: string; // "Foundation" | "SR Legacy" | "Branded" | "Survey (FNDDS)"
  foodNutrients: RawFdcNutrient[];
}

interface RawFdcSearchResult {
  foods: RawFdcFood[];
  totalHits: number;
}

function mapToCanonical(nutrients: RawFdcNutrient[]): CanonicalNutrients {
  const byId = new Map(nutrients.map((n) => [n.nutrient.id, n.amount ?? null]));
  const result = { ...EMPTY_NUTRIENTS };
  for (const [field, nutrientId] of Object.entries(NUTRIENT_ID_MAP) as [
    keyof CanonicalNutrients,
    number,
  ][]) {
    result[field] = byId.get(nutrientId) ?? null;
  }
  return result;
}

export async function searchUsdaFoods(
  query: string,
  dataType: ("Foundation" | "SR Legacy")[] = ["Foundation", "SR Legacy"],
  pageSize = 25,
): Promise<RawFdcFood[]> {
  // Foundation + SR Legacy only — USDA's lab-measured datasets (tier 1).
  // Branded and Survey (FNDDS) data are intentionally excluded here;
  // Branded belongs in Phase 2's branded_products table instead.
  const result = await usdaFetch<RawFdcSearchResult>("/foods/search", {
    query,
    dataType: dataType.join(","),
    pageSize,
  });
  return result.foods;
}

export async function getUsdaFoodById(fdcId: number): Promise<RawFdcFood> {
  return usdaFetch(`/food/${fdcId}`);
}

export function toCanonicalIngredient(food: RawFdcFood): CanonicalIngredient {
  return {
    canonical_name: food.description,
    source: "usda",
    source_id: String(food.fdcId),
    region: null,
    is_cooked: false, // refine per-food in the seed script if a description implies cooked prep
    per_100g: mapToCanonical(food.foodNutrients),
  };
}
