import type {
  ConvertInput,
  GramsResult,
  UnitConversionRule,
  UnitDefinition,
} from "@/types/unit-conversation";

// Pure conversion logic — no Supabase, no "server-only" — so it can be unit
// tested with plain `tsx --test` and reused on the client later if needed.
// The Supabase-backed wrapper is lib/unit-conversions.ts.

const UNIT_ALIASES: Record<string, string> = {
  // mass
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  // volume
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  lt: "l",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  katori: "katori",
  katoris: "katori",
  katora: "katori",
  katoras: "katori",
  // count
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  roti: "roti",
  rotis: "roti",
  chapati: "roti",
  chapatis: "roti",
  phulka: "roti",
  phulkas: "roti",
  idli: "idli",
  idlis: "idli",
  dosa: "dosa",
  dosas: "dosa",
};

export function normalizeUnit(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\.+$/, "");
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

const MASS_TO_GRAMS: Record<string, number> = { g: 1, kg: 1000, mg: 0.001 };
// ml/l are exact by definition; every other volume unit comes from unit_definitions.
const BUILTIN_ML: Record<string, number> = { ml: 1, l: 1000 };

type Pick = { rule: UnitConversionRule } | { ambiguous: true } | null;

/**
 * Choose one rule from candidates that already match on scope and unit.
 * With an explicit state: exact state first, then 'any'.
 * Without: an 'any' rule wins; if only state-specific rules exist the caller
 * must say which — guessing raw vs cooked would silently be off by a factor
 * of 2-3 for rice or dal.
 */
function pickByState(
  cands: UnitConversionRule[],
  state?: "raw" | "cooked",
): Pick {
  if (cands.length === 0) return null;
  if (state) {
    const exact = cands.find((c) => c.state === state);
    if (exact) return { rule: exact };
    const any = cands.find((c) => c.state === "any");
    return any ? { rule: any } : null;
  }
  const any = cands.find((c) => c.state === "any");
  if (any) return { rule: any };
  return { ambiguous: true };
}

export function convertToGrams(
  input: ConvertInput,
  defs: UnitDefinition[],
  rules: UnitConversionRule[],
): GramsResult {
  const { quantity } = input;
  if (
    typeof quantity !== "number" ||
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const unit = normalizeUnit(input.unit);

  if (unit in MASS_TO_GRAMS) {
    return {
      ok: true,
      grams: quantity * MASS_TO_GRAMS[unit],
      basis: "published",
      source: "SI mass unit",
      matchedOn: "mass_unit",
    };
  }

  const def = defs.find((d) => d.unit === unit);
  const unitMl = def?.kind === "volume" ? def.ml : (BUILTIN_ML[unit] ?? null);
  if (!def && unitMl === null) return { ok: false, reason: "unknown_unit" };

  const { ingredientId, foodGroup, state } = input;

  const direct = (scope: "ingredient" | "food_group") =>
    rules.filter(
      (r) =>
        r.unit === unit &&
        r.grams_per_unit !== null &&
        (scope === "ingredient"
          ? !!ingredientId && r.ingredient_id === ingredientId
          : !!foodGroup &&
            r.ingredient_id === null &&
            r.food_group === foodGroup),
    );

  const density = (scope: "ingredient" | "food_group") =>
    rules.filter(
      (r) =>
        r.unit === null &&
        r.density_g_per_ml !== null &&
        (scope === "ingredient"
          ? !!ingredientId && r.ingredient_id === ingredientId
          : !!foodGroup &&
            r.ingredient_id === null &&
            r.food_group === foodGroup),
    );

  // Most specific first. A state ambiguity at a more specific scope stops the
  // search rather than falling through to a looser rule that may disagree.
  const steps: Array<{
    cands: UnitConversionRule[];
    matchedOn:
      | "ingredient"
      | "food_group"
      | "ingredient_density"
      | "food_group_density";
  }> = [
    { cands: direct("ingredient"), matchedOn: "ingredient" },
    { cands: direct("food_group"), matchedOn: "food_group" },
  ];
  if (unitMl !== null) {
    steps.push(
      { cands: density("ingredient"), matchedOn: "ingredient_density" },
      { cands: density("food_group"), matchedOn: "food_group_density" },
    );
  }

  for (const step of steps) {
    const picked = pickByState(step.cands, state);
    if (!picked) continue;
    if ("ambiguous" in picked) return { ok: false, reason: "state_required" };
    const r = picked.rule;
    const grams =
      r.grams_per_unit !== null
        ? quantity * r.grams_per_unit
        : quantity * (unitMl as number) * (r.density_g_per_ml as number);
    return {
      ok: true,
      grams,
      basis: r.basis,
      source: r.source,
      matchedOn: step.matchedOn,
    };
  }

  return { ok: false, reason: "no_conversion" };
}
