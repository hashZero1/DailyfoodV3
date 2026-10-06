import "server-only";
import type { CanonicalNutrients } from "@/types/nutrition";
import { EMPTY_NUTRIENTS } from "@/types/nutrition";
import type { CanonicalBrandedProduct } from "@/types/branded-product";

// No API key required — Open Food Facts is open/ODbL. A descriptive
// User-Agent is their documented etiquette for API consumers.
const USER_AGENT =
  "RecipeMealAssistant/1.0 (contact: set-your-contact-email-here)";

const WORLD_BASE = "https://world.openfoodfacts.org";
// The `in.` subdomain pre-filters search results to products sold in India —
// this is what "Open Food Facts India" means in practice; barcode lookups
// hit the same global product record regardless of subdomain, so those
// always go through world.openfoodfacts.org.
const INDIA_BASE = "https://in.openfoodfacts.org";

async function offFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    // Branded-product data changes (reformulations, new entries) more often
    // than USDA/IFCT reference data, but still not fast — cache for a day.
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    throw new Error(`Open Food Facts request failed (${res.status}): ${url}`);
  }

  return res.json() as Promise<T>;
}

interface RawOffNutriments {
  [key: string]: number | string | undefined;
}

interface RawOffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  countries_tags?: string[];
  nutriments?: RawOffNutriments;
  serving_quantity?: number;
  no_nutrition_data?: string; // "on" when the product explicitly has none
}

interface RawOffProductResponse {
  status: number; // 0 = not found, 1 = found
  product?: RawOffProduct;
}

interface RawOffSearchResponse {
  products: RawOffProduct[];
  count: number;
  page: number;
  page_size: number;
}

// --- Unit normalization -----------------------------------------------
//
// Unlike IFCT (one fixed base unit, verified against the installed
// package), Open Food Facts is crowd-sourced: a `{code}_100g` field's
// actual unit can vary per product, recorded in a companion `{code}_unit`
// field (confirmed via the official Dart and Go OFF client libraries,
// which both model per-nutrient unit fields rather than assuming a fixed
// base unit). We normalize dynamically off that field per record, rather
// than trusting a single static multiplier table the way the IFCT adapter
// safely could.

type TargetUnit = "g" | "mg" | "mcg";

function normalizeOffValue(
  raw: number | string | undefined,
  unit: number | string | undefined,
  targetUnit: TargetUnit,
): number | null {
  const value = typeof raw === "string" ? parseFloat(raw) : raw;
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  const unitStr = typeof unit === "string" ? unit.toLowerCase() : "g"; // OFF's documented default when `_unit` is absent

  let grams: number;
  switch (unitStr) {
    case "kg":
      grams = value * 1000;
      break;
    case "g":
      grams = value;
      break;
    case "mg":
      grams = value / 1000;
      break;
    case "µg":
    case "mcg":
    case "ug":
      grams = value / 1_000_000;
      break;
    case "%":
    case "":
      return null; // not a normalizable mass value — don't guess
    default:
      grams = value; // unrecognized unit string — fall back to OFF's documented grams default rather than silently dropping the value
  }

  switch (targetUnit) {
    case "g":
      return grams;
    case "mg":
      return grams * 1000;
    case "mcg":
      return grams * 1_000_000;
  }
}

interface FieldSpec {
  code: string; // OFF nutriment key, without the _100g/_unit suffix
  target: TargetUnit;
}

const FIELD_MAP: Record<
  Exclude<keyof CanonicalNutrients, "calories_kcal">,
  FieldSpec
> = {
  protein_g: { code: "proteins", target: "g" },
  carbs_g: { code: "carbohydrates", target: "g" },
  fiber_g: { code: "fiber", target: "g" },
  sugar_g: { code: "sugars", target: "g" },
  fat_g: { code: "fat", target: "g" },
  saturated_fat_g: { code: "saturated-fat", target: "g" },
  trans_fat_g: { code: "trans-fat", target: "g" },
  cholesterol_mg: { code: "cholesterol", target: "mg" },
  sodium_mg: { code: "sodium", target: "mg" },
  potassium_mg: { code: "potassium", target: "mg" },
  calcium_mg: { code: "calcium", target: "mg" },
  iron_mg: { code: "iron", target: "mg" },
  magnesium_mg: { code: "magnesium", target: "mg" },
  zinc_mg: { code: "zinc", target: "mg" },
  phosphorus_mg: { code: "phosphorus", target: "mg" },
  vitamin_a_mcg: { code: "vitamin-a", target: "mcg" },
  vitamin_c_mg: { code: "vitamin-c", target: "mg" },
  vitamin_d_mcg: { code: "vitamin-d", target: "mcg" },
  vitamin_e_mg: { code: "vitamin-e", target: "mg" },
  vitamin_k_mcg: { code: "vitamin-k", target: "mcg" },
  vitamin_b12_mcg: { code: "vitamin-b12", target: "mcg" }, // OFF has B12 — fills the gap IFCT leaves null
  folate_mcg: { code: "vitamin-b9", target: "mcg" }, // OFF's tag for folate is "vitamin-b9"
  thiamin_mg: { code: "vitamin-b1", target: "mg" },
  riboflavin_mg: { code: "vitamin-b2", target: "mg" },
  niacin_mg: { code: "vitamin-pp", target: "mg" }, // "PP" (pellagra-preventing) is OFF/EU's tag for niacin
  vitamin_b6_mg: { code: "vitamin-b6", target: "mg" },
};

function mapToCanonical(
  nutriments: RawOffNutriments | undefined,
): CanonicalNutrients {
  const result = { ...EMPTY_NUTRIENTS };
  if (!nutriments) return result;

  // Energy is the one field OFF pre-computes in kcal directly — no unit
  // ambiguity to resolve.
  const kcal = nutriments["energy-kcal_100g"];
  result.calories_kcal =
    typeof kcal === "number"
      ? kcal
      : typeof kcal === "string"
        ? parseFloat(kcal) || null
        : null;

  for (const [field, spec] of Object.entries(FIELD_MAP) as [
    keyof Omit<CanonicalNutrients, "calories_kcal">,
    FieldSpec,
  ][]) {
    const raw = nutriments[`${spec.code}_100g`];
    const unit = nutriments[`${spec.code}_unit`];
    result[field] = normalizeOffValue(raw, unit, spec.target);
  }

  return result;
}

function hasCompleteMacros(n: CanonicalNutrients): boolean {
  return (
    n.calories_kcal !== null &&
    n.protein_g !== null &&
    n.carbs_g !== null &&
    n.fat_g !== null
  );
}

export function toCanonicalBrandedProduct(
  raw: RawOffProduct,
): CanonicalBrandedProduct | null {
  if (!raw.product_name) return null; // unusable without a name, regardless of how much nutrition data exists

  const per100g = mapToCanonical(raw.nutriments);

  return {
    canonical_name: raw.product_name,
    brand: raw.brands?.split(",")[0]?.trim() ?? null,
    barcode: raw.code,
    source: "openfoodfacts",
    countries: raw.countries_tags ?? [],
    per_100g: per100g,
    serving_size_g: raw.serving_quantity ?? null,
    nutrition_data_complete:
      raw.no_nutrition_data !== "on" && hasCompleteMacros(per100g),
  };
}

export async function getProductByBarcode(
  barcode: string,
): Promise<CanonicalBrandedProduct | null> {
  // Barcode lookups are global regardless of subdomain — always use world.
  const data = await offFetch<RawOffProductResponse>(
    `${WORLD_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`,
  );
  if (data.status === 0 || !data.product) return null;
  return toCanonicalBrandedProduct(data.product);
}

export async function searchIndianProducts(
  query: string,
  page = 1,
  pageSize = 24,
): Promise<CanonicalBrandedProduct[]> {
  // v2's /search doesn't support free-text search_terms (confirmed in OFF's
  // own API docs) — only v1's cgi/search.pl does. The `in.` subdomain
  // pre-filters to India-sold products, which is what "Open Food Facts
  // India" means here — there's no separate India-only database.
  const url = new URL(`${INDIA_BASE}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const data = await offFetch<RawOffSearchResponse>(url.toString());
  return data.products
    .map(toCanonicalBrandedProduct)
    .filter((p): p is CanonicalBrandedProduct => p !== null);
}
