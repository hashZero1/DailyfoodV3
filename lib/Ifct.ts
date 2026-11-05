import "server-only";

import type {
  CanonicalIngredient,
  CanonicalNutrients,
} from "@/types/nutrition";

import { EMPTY_NUTRIENTS } from "@/types/nutrition";

import compositions from "@ifct2017/compositions";

// IFCT 2017 — Indian Food Composition Tables 2017.
//
// Uses the MIT-licensed @ifct2017/compositions package.
//
// Important:
// 1. IFCT publishes a national mean per food, not regional values.
// 2. Most foods are raw/base commodities, not cooked dishes.
// 3. Nutrient values are stored in grams, except energy (kJ).

// Use the package's actual return type.
// This avoids incompatible index signatures and unsafe array casts.
export type RawIfctRecord = ReturnType<typeof compositions>[number];

// Extend the canonical ingredient with IFCT food group metadata.
export type IfctCanonicalIngredient = CanonicalIngredient & {
  food_group: string | null;
};

// Prevent duplicate corpus loading from concurrent requests.
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = compositions.load().then(() => undefined);
  }

  try {
    await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

const KJ_PER_KCAL = 4.184;

type FieldMapping =
  | {
      code: string;
      multiplier: number;
    }
  | "energy"
  | null;

// Converts the raw IFCT values into our canonical units.
//
// g   -> ×1
// mg  -> ×1000
// mcg -> ×1,000,000
//
// Energy (enerc) is stored in kJ and handled separately.

const FIELD_MAP: Record<keyof CanonicalNutrients, FieldMapping> = {
  calories_kcal: "energy",

  protein_g: {
    code: "protcnt",
    multiplier: 1,
  },

  carbs_g: {
    code: "choavldf",
    multiplier: 1,
  },

  fiber_g: {
    code: "fibtg",
    multiplier: 1,
  },

  sugar_g: {
    code: "fsugar",
    multiplier: 1,
  },

  fat_g: {
    code: "fatce",
    multiplier: 1,
  },

  saturated_fat_g: {
    code: "fasat",
    multiplier: 1,
  },

  trans_fat_g: {
    code: "fatrn",
    multiplier: 1,
  },

  cholesterol_mg: {
    code: "cholc",
    multiplier: 1000,
  },

  sodium_mg: {
    code: "na",
    multiplier: 1000,
  },

  potassium_mg: {
    code: "k",
    multiplier: 1000,
  },

  calcium_mg: {
    code: "ca",
    multiplier: 1000,
  },

  iron_mg: {
    code: "fe",
    multiplier: 1000,
  },

  magnesium_mg: {
    code: "mg",
    multiplier: 1000,
  },

  zinc_mg: {
    code: "zn",
    multiplier: 1000,
  },

  phosphorus_mg: {
    code: "p",
    multiplier: 1000,
  },

  vitamin_a_mcg: {
    code: "vita",
    multiplier: 1_000_000,
  },

  vitamin_c_mg: {
    code: "vitc",
    multiplier: 1000,
  },

  vitamin_d_mcg: {
    code: "vitd",
    multiplier: 1_000_000,
  },

  vitamin_e_mg: {
    code: "vite",
    multiplier: 1000,
  },

  vitamin_k_mcg: {
    code: "vitk",
    multiplier: 1_000_000,
  },

  // IFCT 2017 does not provide vitamin B12 measurements.
  vitamin_b12_mcg: null,

  folate_mcg: {
    code: "folsum",
    multiplier: 1_000_000,
  },

  thiamin_mg: {
    code: "thia",
    multiplier: 1000,
  },

  riboflavin_mg: {
    code: "ribf",
    multiplier: 1000,
  },

  niacin_mg: {
    code: "nia",
    multiplier: 1000,
  },

  vitamin_b6_mg: {
    code: "vitb6c",
    multiplier: 1000,
  },
};

// Safely read dynamically named nutrient fields.
//
// Reflect.get allows runtime access without requiring
// an index signature on the package's Composition type.
//
// Values are treated as unknown and validated before use.
function readNumericField(record: RawIfctRecord, code: string): number | null {
  const value: unknown = Reflect.get(record, code);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

// Convert IFCT nutrient data into canonical format.
function mapToCanonical(record: RawIfctRecord): CanonicalNutrients {
  const result: CanonicalNutrients = {
    ...EMPTY_NUTRIENTS,
  };

  for (const [field, mapping] of Object.entries(FIELD_MAP) as [
    keyof CanonicalNutrients,
    FieldMapping,
  ][]) {
    if (mapping === null) {
      continue;
    }

    // Energy conversion: kJ -> kcal.
    if (mapping === "energy") {
      const kj = readNumericField(record, "enerc");

      result.calories_kcal = kj !== null ? kj / KJ_PER_KCAL : null;

      continue;
    }

    const raw = readNumericField(record, mapping.code);

    result[field] = raw !== null ? raw * mapping.multiplier : null;
  }

  return result;
}

// Detect names indicating cooked/prepared foods.
const COOKED_NAME_PATTERN =
  /cooked|boiled|fried|roasted|steamed|baked|parboiled/i;

// Search the IFCT food database.
export async function searchIfctFoods(query: string): Promise<RawIfctRecord[]> {
  await ensureLoaded();

  return compositions(query);
}

// Retrieve all foods from the IFCT database.
export async function getAllIfctFoods(): Promise<RawIfctRecord[]> {
  await ensureLoaded();

  // Empty query retrieves the complete available corpus.
  return compositions("");
}

// Convert a raw IFCT food into our canonical ingredient.
export function toCanonicalIngredient(
  record: RawIfctRecord,
): IfctCanonicalIngredient {
  return {
    canonical_name: record.name,

    source: "ifct",

    source_id: record.code,

    // National mean; no regional nutrient breakdown.
    region: null,

    // Original IFCT food group.
    food_group:
      typeof record.grup === "string" && record.grup.length > 0
        ? record.grup
        : null,

    is_cooked: COOKED_NAME_PATTERN.test(record.name),

    per_100g: mapToCanonical(record),
  };
}
