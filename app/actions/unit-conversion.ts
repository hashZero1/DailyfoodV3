import "server-only";
import { createClient } from "@supabase/supabase-js";
import { convertToGrams } from "@/lib/unitAnalysis";
import type {
  ConvertInput,
  GramsResult,
  UnitConversionRule,
  UnitDefinition,
} from "@/types/unit-conversation";

export { convertToGrams, normalizeUnit } from "@/lib/unitAnalysis";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Reference data changes only when you re-run the seed, so a short in-memory
// cache is enough and keeps conversions off the database hot path.
const CACHE_MS = 10 * 60 * 1000;
let cache: {
  at: number;
  defs: UnitDefinition[];
  rules: UnitConversionRule[];
} | null = null;

async function loadUnitData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;

  const supabase = getSupabase();
  const [defsRes, rulesRes] = await Promise.all([
    supabase.from("unit_definitions").select("*"),
    supabase.from("unit_conversions").select("*"),
  ]);
  if (defsRes.error)
    throw new Error(`unit_definitions: ${defsRes.error.message}`);
  if (rulesRes.error)
    throw new Error(`unit_conversions: ${rulesRes.error.message}`);

  // Postgres numeric can arrive as a string; coerce once here.
  const defs = (defsRes.data ?? []).map((d) => ({
    ...d,
    ml: d.ml === null ? null : Number(d.ml),
  })) as UnitDefinition[];
  const rules = (rulesRes.data ?? []).map((r) => ({
    ...r,
    grams_per_unit: r.grams_per_unit === null ? null : Number(r.grams_per_unit),
    density_g_per_ml:
      r.density_g_per_ml === null ? null : Number(r.density_g_per_ml),
  })) as UnitConversionRule[];

  cache = { at: Date.now(), defs, rules };
  return cache;
}

/** Convert a quantity + unit to grams of the food *in the stated state*. */
export async function toGrams(input: ConvertInput): Promise<GramsResult> {
  const { defs, rules } = await loadUnitData();
  return convertToGrams(input, defs, rules);
}

/**
 * Convenience for callers that only have an ingredient id: looks up the
 * ingredient's food_group, then converts.
 */
export async function toGramsForIngredient(
  ingredientId: string,
  quantity: number,
  unit: string,
  state?: "raw" | "cooked",
): Promise<GramsResult> {
  const { data } = await getSupabase()
    .from("ingredients")
    .select("food_group")
    .eq("id", ingredientId)
    .maybeSingle();

  return toGrams({
    quantity,
    unit,
    ingredientId,
    foodGroup: data?.food_group ?? null,
    state,
  });
}
