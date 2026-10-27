This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

<!-- OCT INFORMATION -->

# Regional Nutrition Data Subsystem

Companion to the Recipe & Meal Assistant app. Adds a verified, source-traceable nutrition
layer (USDA, IFCT 2017, Open Food Facts) that sits **alongside** Spoonacular rather than
replacing it. Core rule carried over from the rest of the app: **AI never invents a nutrient
value.** Every number traces to a source and a confidence tier.

Full phase plan: `nutrition-data-roadmap.md`.

---

## Status

| Phase | Scope                                                                            | Status                                         |
| ----- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1     | USDA + IFCT 2017 -> `ingredients` table                                          | Built, seeds not yet run against live Supabase |
| 2     | Open Food Facts India -> `branded_products` table                                | Built, not verified against live OFF data      |
| 3     | `unit_conversions` (katori, tbsp, roti -> grams)                                 | Next                                           |
| 4-8   | Firecrawl, resolution engine, pgvector corpus, confidence-tier UI, live fallback | Longer-horizon                                 |

---

## File map

```
types/
  nutrition.ts            Canonical nutrient schema (27 fields, all per 100g) + CanonicalIngredient
  branded-product.ts      CanonicalBrandedProduct (adds brand, barcode, serving size)
lib/
  usda.ts                 USDA FoodData Central adapter (Foundation + SR Legacy only)
  ifct.ts                 IFCT 2017 adapter via @ifct2017/compositions
  openfoodfacts.ts        Open Food Facts adapter (barcode lookup + India search)
  branded-products.ts     Cache-on-lookup layer over openfoodfacts.ts + Supabase
scripts/
  seed-ingredients-usda.ts
  seed-ingredients-ifct.ts
supabase/
  nutrition-phase1-schema.sql   `ingredients` table
  nutrition-phase2-schema.sql   `branded_products` table
ifct-ingredients-seed.json      Pre-computed rows for all 542 IFCT foods (optional bulk import)
nutrition-data-roadmap.md       Phase plan, open decisions, corrections log
```

---

## Setup

### 1. Dependencies

```bash
npm install @supabase/supabase-js @ifct2017/compositions
npm install -D tsx dotenv
```

`server-only` is already in your project (used by `lib/spoonacular.ts`).

### 2. Environment variables (`.env.local`)

| Variable                                                        | Used by                      | Notes                                                      |
| --------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                      | seeds, `branded-products.ts` | Existing                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                     | seeds, `branded-products.ts` | Existing. Server-side only                                 |
| `USDA_FDC_API_KEY`                                              | `lib/usda.ts`                | **New.** Free key: https://fdc.nal.usda.gov/api-key-signup |
| `SPOONACULAR_API_KEY`, `GEMINI_API_KEY`, Auth0 and Upstash vars | rest of app                  | Unchanged                                                  |

Open Food Facts needs **no key**. Before shipping, edit the `USER_AGENT` constant in
`lib/openfoodfacts.ts` and put a real contact email in it (OFF's API etiquette).

### 3. Database

Run in the Supabase SQL editor, in order:

1. `supabase/nutrition-phase1-schema.sql`
2. `supabase/nutrition-phase2-schema.sql`

Both follow your existing access model: RLS enabled with **no policies**, so only the
service-role key (server-side) can read or write.

### 4. Seed

```bash
npx tsx scripts/seed-ingredients-ifct.ts   # all 542 IFCT foods, no external network needed
npx tsx scripts/seed-ingredients-usda.ts   # starter list of ~13 staples, needs USDA key
```

`branded_products` has **no seed script by design**. Open Food Facts has 3M+ products, so the
table fills lazily from real barcode lookups and searches.

**Alternative for IFCT:** bulk-import `ifct-ingredients-seed.json` through the Supabase
dashboard instead of running the script.

**Likely snag:** `lib/*.ts` import `"server-only"`, which throws outside a Next.js build. If a
seed script fails with a server-only error, try
`npx tsx --conditions=react-server scripts/<file>.ts`. This is untested; I could not run the
scripts in my sandbox.

---

## Data sources and licensing

| Source                | Package / API                            | License                                                              | Tier |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------- | ---- |
| IFCT 2017 (NIN/ICMR)  | `@ifct2017/compositions` (older lineage) | MIT (verified in installed package)                                  | 1    |
| USDA FoodData Central | REST API                                 | Public domain (US government)                                        | 1    |
| Open Food Facts       | REST API                                 | ODbL (attribute OFF in your UI; share-alike applies to the database) | 2    |

**Do not use `@nodef/ifct2017`.** It switched to AGPL-3.0 in April 2025, and its AGPL release
adds no regional data over the MIT package.

---

## Confidence tiers

1. Lab-verified official data (USDA Foundation/SR Legacy, IFCT)
2. Manufacturer package labels (Open Food Facts)
3. Algorithmic recipe breakdown (Phase 5)
4. Estimated fallback (scraped macros, AI estimate)

Tracked **per nutrient**, not just per recipe. Phase 7 surfaces these as badges, extending the
existing `(AI-suggested)` pattern.

---

## Things to know (corrections and caveats)

**IFCT**

- **No regional breakdown.** IFCT samples six regions but publishes one national mean per
  food (plus standard error). The `regn` field is metadata, not a region selector.
- **Almost no cooked dishes.** About 9 of 542 entries are cooked-prep names, mostly boiled eggs.
  Phase 5 cannot rely on IFCT for pre-composed dishes.
- **Units:** every raw field is in grams except `enerc`, which is kJ (converted at 4.184 kJ per kcal).
- **Vitamin B12 is always null** for IFCT rows; IFCT does not measure it.
- **`sugar_g` is "free sugars"**, not identical to USDA's "total sugars".
- **Vitamin D looks implausibly high** for some plants (e.g. 58-118 ug/100g). This is
  transcribed correctly: NIN published it as the first report of D2 in plant foods. Treat as a
  low-confidence candidate once Phase 7 exists.
- The package's own description says "528 foods"; the data file actually has 542.

**USDA**

- Only Foundation and SR Legacy are queried. Branded data belongs in `branded_products`.
- Seed takes the top search hit per query, so spot-check matches. Many Indian staples (paneer,
  atta, toor dal) will not resolve well; that is what IFCT covers.
- `is_cooked` is always `false` for USDA rows right now.

**Open Food Facts**

- Crowd-sourced: a nutrient's unit can vary per product. The adapter reads each record's
  `_unit` field and normalizes dynamically.
- **Not yet verified against live data.** Run a few real Indian barcodes and sanity-check output
  before trusting it.
- Barcode lookups use `world.openfoodfacts.org`; free-text search uses `in.openfoodfacts.org`
  (v1 `cgi/search.pl`, because v2 `/search` has no text search). There is no separate India
  database.
- Many products have partial nutrition. `nutrition_data_complete` is true only when energy,
  protein, carbs and fat are all present.

**Existing `schema.sql` housekeeping (not part of this subsystem)**

- `shopping_list_items` is created three times (harmless, but the later copies drop the
  `source` column definition).
- `meal_plan_entries` gets both `protein_g`/`carbs_g`/`fat_g` and `protein`/`carbs`/`fat`.
  Check which names your code actually reads.

---

## Open decisions (from the roadmap)

1. **Spoonacular nutrition:** leaning towards overriding with this system when a confident
   match exists, falling back to Spoonacular (tier 4) otherwise.
2. **Region handling:** moot, since IFCT has no regions. Standard error could later flag
   high-variance nutrients.
3. **Scope:** Phases 1-3 near-term; 4-8 longer-horizon.

---

## Next: Phase 3 (unit conversions)

`unit_conversions` table, category-aware (a katori of rice is not a katori of dal): katori,
tbsp, tsp, cup, piece, roti -> grams. Needed by pantry quantities, recipe scaling and the
Phase 5 resolution engine.
