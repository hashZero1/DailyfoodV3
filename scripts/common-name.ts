/**
 * Stage 2b: ask Gemini (with Google Search grounding) for the name most people in India
 * actually use for each IFCT food, plus a few "also known as" names, and save them.
 *
 *   npx tsx scripts/enrich-common-names.ts              # call Gemini, write data/common-names.json, update Supabase
 *   npx tsx scripts/enrich-common-names.ts --file-only  # write the JSON only, no DB writes
 *   npx tsx scripts/enrich-common-names.ts --apply-only # push the existing JSON to Supabase, no Gemini calls
 *
 * Needs GEMINI_API_KEY (+ Supabase env vars unless --file-only). Optional GEMINI_MODEL.
 * Output is AI-suggested and saved with common_name_source='ai', common_name_reviewed=false;
 * review data/common-names.json before trusting it. Rows already marked reviewed, or whose
 * source is 'user'/'curated', are never overwritten. NOT run by me (no network in my
 * sandbox): the Gemini grounding request shape is unverified, so try one batch first.
 * Nutrient values are never touched; this only sets display names and match aliases.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const BATCH = 20;
const OUT = "data/common-names.json";

interface SeedRow {
  source_id: string;
  canonical_name: string;
  scientific_name?: string | null;
  aliases?: string[];
}
interface NameEntry {
  source_id: string;
  common_name: string;
  also_known_as: string[];
}

const args = new Set(process.argv.slice(2));

function validate(raw: unknown, wanted: string[]): NameEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: NameEntry[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r?.source_id !== "string" || !wanted.includes(r.source_id))
      return null;
    const cn = typeof r.common_name === "string" ? r.common_name.trim() : "";
    if (!cn || cn.length > 60) return null;
    const aka = Array.isArray(r.also_known_as)
      ? (r.also_known_as as unknown[])
          .filter(
            (x): x is string =>
              typeof x === "string" && x.trim().length > 0 && x.length <= 40,
          )
          .map((x) => x.trim())
          .slice(0, 4)
      : [];
    out.push({ source_id: r.source_id, common_name: cn, also_known_as: aka });
  }
  return new Set(out.map((o) => o.source_id)).size === wanted.length &&
    out.length === wanted.length
    ? out
    : null;
}

async function askGemini(rows: SeedRow[]): Promise<NameEntry[] | null> {
  const list = rows.map((r) => ({
    source_id: r.source_id,
    official_name: r.canonical_name,
    scientific_name: r.scientific_name ?? null,
    local_names: (r.aliases ?? []).slice(0, 12),
  }));
  const prompt = `For each Indian food below, give the name most people in India use for it in everyday kitchens and markets (the Hindi or English word people actually say, e.g. "Bhindi", "Paneer", "Tomato"). If the official English name is already the common one, use it. Also give up to 4 other well-known names (English or major Indian languages). Use web search to check. If unsure, use the official name; never invent a name.
Reply with ONLY a JSON array, one object per food, same source_id values:
[{"source_id":"...","common_name":"...","also_known_as":["..."]}]

Foods:
${JSON.stringify(list)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );
  if (!res.ok) {
    console.error(
      `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return null;
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    return validate(
      JSON.parse(m[0]),
      rows.map((r) => r.source_id),
    );
  } catch {
    return null;
  }
}

async function main() {
  const entries: NameEntry[] = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8")).entries
    : [];
  if (!args.has("--apply-only")) {
    const seed = JSON.parse(
      readFileSync("ifct-ingredients-seed.json", "utf8"),
    ) as SeedRow[];
    const done = new Set(entries.map((e) => e.source_id));
    const todo = seed.filter((r) => !done.has(r.source_id));
    console.log(
      `${todo.length} foods to name (${done.size} already in ${OUT})`,
    );
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      let got = await askGemini(batch);
      if (!got) got = await askGemini(batch); // one retry
      if (!got) {
        console.error(
          `Batch starting ${batch[0].source_id} failed validation twice; skipped`,
        );
        continue;
      }
      entries.push(...got);
      writeFileSync(
        OUT,
        JSON.stringify(
          {
            note: "AI-suggested, unreviewed. Edit freely, then --apply-only.",
            entries,
          },
          null,
          1,
        ),
      );
      console.log(`  ${entries.length} named`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (args.has("--file-only")) return;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  let updated = 0,
    skipped = 0;
  for (const e of entries) {
    const { data, error } = await supabase
      .from("ingredients")
      .update({
        common_name: e.common_name,
        also_known_as: e.also_known_as,
        common_name_source: "ai",
        common_name_reviewed: false,
      })
      .eq("source", "ifct")
      .eq("source_id", e.source_id)
      .eq("common_name_reviewed", false) // never overwrite a reviewed name
      .select("id");
    if (error) {
      console.error(`${e.source_id}: ${error.message}`);
      continue;
    }
    data?.length ? updated++ : skipped++;
  }
  console.log(`Updated ${updated}, left ${skipped} (reviewed or missing).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
