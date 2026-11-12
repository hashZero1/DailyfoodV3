import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  resolveIngredientLine,
  type IngredientCandidate,
} from "./ingredientResolver";

export * from "./ingredientResolver";

// Server wrapper: loads the ingredient candidates once (10-minute cache, same
// pattern as unit-conversions.ts) and resolves lines against them in memory.
// Deterministic only. Ambiguous outcomes carry their candidate list so a later
// step (Gemini, validated against these exact IDs) can choose among them; this
// module never lets a model invent an ingredient.

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; rows: IngredientCandidate[] } | null = null;

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function loadIngredientCandidates(): Promise<
  IngredientCandidate[]
> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;

  const rows: IngredientCandidate[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client()
      .from("ingredients")
      .select(
        "id, source, source_id, canonical_name, aliases, scientific_name, food_group",
      )
      .range(from, from + page - 1);
    if (error) throw new Error(`loadIngredientCandidates: ${error.message}`);
    rows.push(...((data ?? []) as IngredientCandidate[]));
    if (!data || data.length < page) break;
  }
  cache = { at: Date.now(), rows };
  return rows;
}

export async function resolveIngredient(line: string) {
  return resolveIngredientLine(line, await loadIngredientCandidates());
}

// Ingredient Resolver Test
// import test from "node:test";
// import assert from "node:assert/strict";
// import {
//   parseIngredientLine,
//   parseLocalNames,
//   resolveIngredientLine,
//   type IngredientCandidate,
// } from "./ingredient-resolver-core";

// const cands: IngredientCandidate[] = [
//   { source: "ifct", source_id: "G017", canonical_name: "Onion, big", aliases: ["Pyaz"] },
//   { source: "ifct", source_id: "G018", canonical_name: "Onion, small", aliases: [] },
//   { source: "ifct", source_id: "L003", canonical_name: "Paneer", aliases: [] },
//   { source: "ifct", source_id: "D036", canonical_name: "Cauliflower", aliases: [] },
//   { source: "ifct", source_id: "C017", canonical_name: "Cauliflower leaves", aliases: ["Cauliflower"] },
//   { source: "ifct", source_id: "A018", canonical_name: "Wheat flour, refined", aliases: ["Maida", "Oat"] },
// ];

// test("parses quantity, unit, name", () => {
//   const p = parseIngredientLine("1 1/2 cups chopped paneer");
//   assert.equal(p.quantity, 1.5);
//   assert.equal(p.unit, "cup");
//   assert.equal(p.name, "chopped paneer");
// });
// test("ranges are not guessed", () => {
//   const p = parseIngredientLine("2-3 green chillies");
//   assert.equal(p.quantity, null);
//   assert.equal(p.quantity_is_range, true);
// });
// test("glued unit and unicode fraction", () => {
//   assert.equal(parseIngredientLine("200g paneer").unit, "g");
//   assert.equal(parseIngredientLine("½ cup paneer").quantity, 0.5);
// });
// test("local names strip language prefixes and split commas", () => {
//   assert.deepEqual(parseLocalNames("A., Kash. Baajra; E. Pearl millet; H. Okra, Okro."), ["Baajra", "Pearl millet", "Okra", "Okro"]);
// });
// test("exact name resolves; alias works", () => {
//   assert.equal(resolveIngredientLine("200 g paneer", cands).outcome.status, "resolved");
//   const o = resolveIngredientLine("1 tbsp pyaz", cands).outcome;
//   assert.equal(o.status, "resolved");
// });
// test("equal-fit variants are ambiguous, never picked", () => {
//   const o = resolveIngredientLine("1 onion, chopped", cands).outcome;
//   assert.equal(o.status, "ambiguous");
// });
// test("alias equal to another food's name does not steal the match", () => {
//   const o = resolveIngredientLine("1 cup cauliflower", cands).outcome;
//   assert.equal(o.status, "resolved");
//   if (o.status === "resolved") assert.equal(o.match.candidate.source_id, "D036");
// });
// test("denylisted bad alias is ignored; unknown food is unresolved", () => {
//   assert.equal(resolveIngredientLine("1 cup oats", cands).outcome.status, "unresolved");
// });
// test("water is negligible, not a failed match", () => {
//   const o = resolveIngredientLine("1 cup water", cands).outcome;
//   assert.deepEqual(o, { status: "unresolved", reason: "negligible" });
// });
