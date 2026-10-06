/**
 * One-off seed script — Phase 1, IFCT half.
 * Usage: npx tsx scripts/seed-ingredients-ifct.ts
 *
 * Unlike the USDA half, this isn't query-driven — @ifct2017/compositions
 * bundles its full 542-food dataset locally, so this seeds all of it in one
 * pass rather than searching term by term.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getAllIfctFoods, toCanonicalIngredient } from "../lib/Ifct";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const foods = await getAllIfctFoods();
  console.log(`Loaded ${foods.length} IFCT foods — seeding...`);

  let inserted = 0;
  let failed = 0;

  for (const food of foods) {
    const ingredient = toCanonicalIngredient(food);

    const { error } = await supabase
      .from("ingredients")
      .upsert(ingredient, { onConflict: "source,source_id,region" });

    if (error) {
      console.error(
        `Failed to upsert "${food.name}" (${food.code}):`,
        error.message,
      );
      failed++;
      continue;
    }

    inserted++;
  }

  console.log(`\nDone — ${inserted} inserted/updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
