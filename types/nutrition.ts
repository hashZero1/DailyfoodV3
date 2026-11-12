/**
 * Canonical nutrient schema — Phase 1 of the regional nutrition data
 * subsystem (see nutrition-data-roadmap.md).
 *
 * USDA, IFCT, and (later) Open Food Facts each use a different shape for
 * nutrition data. Every source adapter maps into this one shape, and this
 * is the ONLY shape the rest of the app should ever read nutrition data as.
 *
 * All amounts are per 100g of the edible portion.
 */
export interface CanonicalNutrients {
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  magnesium_mg: number | null;
  zinc_mg: number | null;
  phosphorus_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_c_mg: number | null;
  vitamin_d_mcg: number | null;
  vitamin_e_mg: number | null;
  vitamin_k_mcg: number | null;
  vitamin_b12_mcg: number | null;
  folate_mcg: number | null;
  thiamin_mg: number | null;
  riboflavin_mg: number | null;
  niacin_mg: number | null;
  vitamin_b6_mg: number | null;
}

export const EMPTY_NUTRIENTS: CanonicalNutrients = {
  calories_kcal: null,
  protein_g: null,
  carbs_g: null,
  fiber_g: null,
  sugar_g: null,
  fat_g: null,
  saturated_fat_g: null,
  trans_fat_g: null,
  cholesterol_mg: null,
  sodium_mg: null,
  potassium_mg: null,
  calcium_mg: null,
  iron_mg: null,
  magnesium_mg: null,
  zinc_mg: null,
  phosphorus_mg: null,
  vitamin_a_mcg: null,
  vitamin_c_mg: null,
  vitamin_d_mcg: null,
  vitamin_e_mg: null,
  vitamin_k_mcg: null,
  vitamin_b12_mcg: null,
  folate_mcg: null,
  thiamin_mg: null,
  riboflavin_mg: null,
  niacin_mg: null,
  vitamin_b6_mg: null,
};

export type IngredientSource = "usda" | "ifct";

export interface CanonicalIngredient {
  id?: string; // uuid, assigned by Supabase on insert
  canonical_name: string;
  source: IngredientSource;
  source_id: string; // USDA fdcId (stringified) or IFCT food code
  region: string | null; // IFCT region tag; null for USDA / national-only entries
  // IFCT group name (e.g. "Cereals and Millets"). Null/absent for USDA rows:
  // I haven't verified a usable category field in USDA search results, so
  // USDA rows only get ingredient-specific unit conversions for now.
  food_group?: string | null;
  // Local/regional names from the source (IFCT `lang` field), e.g. "Ramdana". Used by
  // the Stage 2 resolver. Needs nutrition-stage2-schema.sql applied first.
  aliases?: string[];
  scientific_name?: string | null;
  is_cooked: boolean; // true for a pre-composed cooked-dish entry rather than a raw commodity
  per_100g: CanonicalNutrients;
}
