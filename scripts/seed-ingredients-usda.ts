/**
 * One-off seed script — Phase 1, USDA half.
 * Usage: npx tsx scripts/seed-ingredients-usda.ts
 *
 * Seeds the `ingredients` table from a curated list of common raw-commodity
 * search terms, using USDA Foundation/SR Legacy data only. This is a
 * starting set, not the full ingredient catalog — extend SEED_QUERIES as
 * the recipe corpus surfaces ingredients with no match yet.
 *
 * The IFCT half of Phase 1 is deliberately not included here yet — see the
 * licensing note in chat before wiring that up.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { searchUsdaFoods, toCanonicalIngredient } from "../lib/usda";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SEED_QUERIES = [
  "rice, white, raw",
  "wheat flour, whole-grain",
  "lentils, raw",
  "chickpeas, raw",
  "chicken breast, raw",
  "egg, whole, raw",
  "milk, whole",
  "onion, raw",
  "tomato, raw",
  "potato, raw",
  "spinach, raw",
  "ghee",
  "yogurt, plain",
  // ...extend as needed. Several Indian staples (paneer, atta, toor dal,
  // specific regional vegetables) won't resolve well against USDA at all —
  // that gap is exactly what IFCT is for.
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const query of SEED_QUERIES) {
    const foods = await searchUsdaFoods(query, ["Foundation", "SR Legacy"], 3);
    if (foods.length === 0) {
      console.warn(`No USDA match for "${query}" — skipping`);
      skipped++;
      continue;
    }

    // Takes the top result per query. If a query needs multiple variants
    // (e.g. "rice, white, raw" vs "rice, brown, raw"), add them as
    // separate entries in SEED_QUERIES rather than branching here.
    const ingredient = toCanonicalIngredient(foods[0]);

    const { error } = await supabase
      .from("ingredients")
      .upsert(ingredient, { onConflict: "source,source_id" });

    if (error) {
      console.error(`Failed to upsert "${query}":`, error.message);
      continue;
    }

    console.log(
      `Seeded: ${ingredient.canonical_name} (fdcId ${ingredient.source_id})`,
    );
    inserted++;
  }

  console.log(`\nDone — ${inserted} inserted/updated, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
