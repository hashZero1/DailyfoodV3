import type { CanonicalNutrients } from "@/types/nutrition";

/**
 * Phase 2 of the regional nutrition data subsystem — branded/packaged
 * products, primarily via Open Food Facts. Separate shape from
 * CanonicalIngredient because branded products carry metadata (brand,
 * barcode, serving size) that raw commodities don't have.
 */
export interface CanonicalBrandedProduct {
  id?: string;
  canonical_name: string;
  brand: string | null;
  barcode: string; // EAN/UPC — OFF's own "code" field
  source: "openfoodfacts";
  countries: string[]; // OFF countries_tags, e.g. ["en:india"]
  per_100g: CanonicalNutrients;
  serving_size_g: number | null;
  // true only when OFF itself reports complete core macros (energy, protein,
  // carbs, fat) for this product — many crowd-sourced entries are partial.
  nutrition_data_complete: boolean;
}
