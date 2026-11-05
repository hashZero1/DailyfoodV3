/**
 * Phase 3 — household-unit -> grams conversion types.
 * Reference data lives in `unit_definitions` / `unit_conversions`
 * (supabase/nutrition-phase3-schema.sql).
 */
export type UnitKind = "volume" | "count";

/** State of the food as measured. 'cooked' = grams of cooked food. */
export type FoodState = "raw" | "cooked" | "any";

/** How trustworthy a row is. Surface this later in the confidence UI. */
export type ConversionBasis =
  | "published"
  | "user-defined"
  | "derived"
  | "assumed";

export interface UnitDefinition {
  unit: string;
  kind: UnitKind;
  ml: number | null; // volume units only
  basis: ConversionBasis;
  source: string;
  note?: string | null;
}

export interface UnitConversionRule {
  ingredient_id: string | null;
  food_group: string | null;
  state: FoodState;
  /** null on density rows, which apply to every volume unit. */
  unit: string | null;
  grams_per_unit: number | null;
  density_g_per_ml: number | null;
  basis: ConversionBasis;
  source: string;
  note?: string | null;
}

export interface ConvertInput {
  quantity: number;
  /** Raw unit text; normalized internally ('Tablespoons' -> 'tbsp'). */
  unit: string;
  ingredientId?: string | null;
  foodGroup?: string | null;
  /** State of the food as measured. Required whenever the matching rules differ by state. */
  state?: "raw" | "cooked";
}

export type MatchedOn =
  | "mass_unit"
  | "volume_unit_density"
  | "ingredient"
  | "food_group"
  | "ingredient_density"
  | "food_group_density";

export type ConvertFailureReason =
  | "invalid_quantity"
  | "unknown_unit" // unit not in unit_definitions (and not g/kg/mg/ml/l)
  | "state_required" // rules exist but differ by raw/cooked and the caller gave none
  | "no_conversion"; // unit is known but nothing is recorded for this food

export type GramsResult =
  | {
      ok: true;
      grams: number;
      basis: ConversionBasis;
      source: string;
      matchedOn: MatchedOn;
    }
  | { ok: false; reason: ConvertFailureReason };
