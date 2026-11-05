/**
 * Phase 3 seed — unit_definitions + unit_conversions.
 * Usage: npx tsx --conditions=react-server scripts/seed-unit-conversions.ts
 * (Run nutrition-phase3-schema.sql first. Safe to re-run.)
 *
 * Reference data, fully managed by data/unit-conversions.seed.json:
 * definitions are upserted by unit; conversions are replaced wholesale so a
 * row removed from the JSON disappears from the table too.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface SeedConversion {
  food_group?: string;
  ingredient_ref?: { source: "usda" | "ifct"; source_id: string };
  state?: "raw" | "cooked" | "any";
  unit?: string;
  grams_per_unit?: number;
  density_g_per_ml?: number;
  basis: "published" | "user-defined" | "derived" | "assumed";
  source: string;
  note?: string;
}

async function main() {
  const seed = JSON.parse(
    readFileSync(
      join(process.cwd(), "data", "unit-conversions.seed.json"),
      "utf8",
    ),
  ) as {
    unit_definitions: Record<string, unknown>[];
    conversions: SeedConversion[];
  };

  // 1. Definitions first — conversions reference them.
  const { error: defErr } = await supabase
    .from("unit_definitions")
    .upsert(seed.unit_definitions, { onConflict: "unit" });
  if (defErr) throw new Error(`unit_definitions: ${defErr.message}`);
  console.log(`unit_definitions: ${seed.unit_definitions.length} upserted`);

  // 2. Validate before touching the table: no source, no row.
  const rows: Record<string, unknown>[] = [];
  for (const [i, c] of seed.conversions.entries()) {
    if (!c.source?.trim())
      throw new Error(`conversions[${i}] has no source — refusing to seed`);

    let ingredient_id: string | null = null;
    if (c.ingredient_ref) {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id")
        .eq("source", c.ingredient_ref.source)
        .eq("source_id", c.ingredient_ref.source_id)
        .maybeSingle();
      if (error || !data) {
        throw new Error(
          `conversions[${i}]: ingredient ${c.ingredient_ref.source}:${c.ingredient_ref.source_id} not found — seed ingredients first`,
        );
      }
      ingredient_id = data.id;
    }

    rows.push({
      ingredient_id,
      food_group: c.food_group ?? null,
      state: c.state ?? "any",
      unit: c.unit ?? null,
      grams_per_unit: c.grams_per_unit ?? null,
      density_g_per_ml: c.density_g_per_ml ?? null,
      basis: c.basis,
      source: c.source,
      note: c.note ?? null,
    });
  }

  // 3. Replace conversions wholesale (only after validation passed).
  const { error: delErr } = await supabase
    .from("unit_conversions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw new Error(`clearing unit_conversions: ${delErr.message}`);

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("unit_conversions")
      .insert(rows);
    if (insErr) throw new Error(`unit_conversions: ${insErr.message}`);
  }
  console.log(
    `unit_conversions: ${rows.length} inserted${rows.length === 0 ? " (none sourced yet)" : ""}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
