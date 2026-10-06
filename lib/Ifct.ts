import "server-only";
import type {
  CanonicalIngredient,
  CanonicalNutrients,
} from "@/types/nutrition";
import { EMPTY_NUTRIENTS } from "@/types/nutrition";
// CJS package, no default-export ambiguity issue in practice — same pattern
// Next.js already handles fine for other untyped/partial-typed deps.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compositions = require("@ifct2017/compositions");

// IFCT 2017 ("Indian Food Composition Tables 2017", NIN/ICMR) via the
// MIT-licensed @ifct2017/compositions package — confirmed MIT directly from
// the installed package.json/LICENSE, not from a doc page. 542 foods (the
// package's own description text is stale and still says "528"; the actual
// data file has the full current set). Deliberately NOT using
// @nodef/ifct2017 — that package switched to AGPL-3.0 in April 2025.
//
// Two corrections to keep in mind vs. what's commonly assumed about IFCT:
//   1. No regional breakdown. IFCT samples from 6 regional compositing
//      centres but publishes ONE national mean per food (plus a standard
//      error, in the `_e`-suffixed fields, not mapped here yet). There is
//      no "South Indian pineapple" value to look up.
//   2. Almost no pre-composed cooked dishes. Of 542 entries, only 9 have
//      any cooked-prep-sounding name (mostly just boiled eggs) — this is a
//      raw/base-commodity table, not a dish database. Phase 5's
//      ingredient-resolution engine should not expect to find many direct
//      cooked-dish matches here.
//
// Column codes and units below were read directly from the installed
// package's own data files (node_modules/@ifct2017/{columns,representations}
// /index.csv), not guessed. Every raw field is stored in grams, EXCEPT
// `enerc` (energy), which is stored directly in kJ.

let loaded = false;
async function ensureLoaded(): Promise<void> {
  if (!loaded) {
    await compositions.load();
    loaded = true;
  }
}

export interface RawIfctRecord {
  code: string; // e.g. "A013"
  name: string; // e.g. "Rice, raw, brown"
  scie?: string; // scientific name
  grup?: string; // food group, e.g. "Cereals and Millets"
  regn?: number; // always 6 — number of regional compositing centres sampled, NOT a region selector
  [nutrientField: string]: unknown;
}

const KJ_PER_KCAL = 4.184;

type FieldMapping = { code: string; multiplier: number } | "energy" | null;

// multiplier converts the raw gram-denominated IFCT value into the unit our
// canonical field name promises (×1 for _g fields, ×1000 for _mg, ×1e6 for
// _mcg) — this is OUR schema's unit choice, independent of whatever "natural"
// display unit IFCT's own representations.csv suggests for the same column.
const FIELD_MAP: Record<keyof CanonicalNutrients, FieldMapping> = {
  calories_kcal: "energy", // enerc is stored in kJ, not grams — special-cased below
  protein_g: { code: "protcnt", multiplier: 1 },
  carbs_g: { code: "choavldf", multiplier: 1 }, // available carbohydrate, by difference
  fiber_g: { code: "fibtg", multiplier: 1 },
  sugar_g: { code: "fsugar", multiplier: 1 }, // "free sugars" — not an identical definition to USDA's "total sugars"; a known adapter-level difference, not a bug
  fat_g: { code: "fatce", multiplier: 1 },
  saturated_fat_g: { code: "fasat", multiplier: 1 },
  trans_fat_g: { code: "fatrn", multiplier: 1 },
  cholesterol_mg: { code: "cholc", multiplier: 1000 },
  sodium_mg: { code: "na", multiplier: 1000 },
  potassium_mg: { code: "k", multiplier: 1000 },
  calcium_mg: { code: "ca", multiplier: 1000 },
  iron_mg: { code: "fe", multiplier: 1000 },
  magnesium_mg: { code: "mg", multiplier: 1000 }, // IFCT column code "mg" = magnesium, not a unit — don't confuse with the multiplier unit
  zinc_mg: { code: "zn", multiplier: 1000 },
  phosphorus_mg: { code: "p", multiplier: 1000 },
  vitamin_a_mcg: { code: "vita", multiplier: 1_000_000 }, // total vitamin A, retinol equivalents
  vitamin_c_mg: { code: "vitc", multiplier: 1000 },
  vitamin_d_mcg: { code: "vitd", multiplier: 1_000_000 },
  vitamin_e_mg: { code: "vite", multiplier: 1000 }, // alpha-tocopherol equivalent
  vitamin_k_mcg: { code: "vitk", multiplier: 1_000_000 },
  vitamin_b12_mcg: null, // IFCT 2017 does not measure B12 at all — always null for IFCT-sourced rows, not a lookup failure
  folate_mcg: { code: "folsum", multiplier: 1_000_000 },
  thiamin_mg: { code: "thia", multiplier: 1000 },
  riboflavin_mg: { code: "ribf", multiplier: 1000 },
  niacin_mg: { code: "nia", multiplier: 1000 },
  vitamin_b6_mg: { code: "vitb6c", multiplier: 1000 },
};

function mapToCanonical(record: RawIfctRecord): CanonicalNutrients {
  const result = { ...EMPTY_NUTRIENTS };

  for (const [field, mapping] of Object.entries(FIELD_MAP) as [
    keyof CanonicalNutrients,
    FieldMapping,
  ][]) {
    if (mapping === null) continue;

    if (mapping === "energy") {
      const kj = record.enerc;
      result.calories_kcal = typeof kj === "number" ? kj / KJ_PER_KCAL : null;
      continue;
    }

    const raw = record[mapping.code];
    result[field] = typeof raw === "number" ? raw * mapping.multiplier : null;
  }

  return result;
}

// Names sounding like a cooked prep rather than a raw commodity. Real but
// rare in this dataset (9 of 542) — see the file-level note above.
const COOKED_NAME_PATTERN =
  /cooked|boiled|fried|roasted|steamed|baked|parboiled/i;

export async function searchIfctFoods(query: string): Promise<RawIfctRecord[]> {
  await ensureLoaded();
  return compositions(query) as RawIfctRecord[];
}

export async function getAllIfctFoods(): Promise<RawIfctRecord[]> {
  await ensureLoaded();
  // Empty query returns the full corpus — verified directly against the
  // installed package (542 records), not assumed from docs.
  return compositions("") as RawIfctRecord[];
}

export function toCanonicalIngredient(
  record: RawIfctRecord,
): CanonicalIngredient {
  return {
    canonical_name: record.name,
    source: "ifct",
    source_id: record.code,
    region: null, // IFCT publishes one national mean (+ SD) per food, not per-region values
    is_cooked: COOKED_NAME_PATTERN.test(record.name),
    per_100g: mapToCanonical(record),
  };
}
