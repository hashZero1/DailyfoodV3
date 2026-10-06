# Regional Nutrition Data Subsystem — Roadmap

## Why this exists

Spoonacular's recipe data and nutrition figures are US/global-commodity-centric and capped
to whatever's in their corpus. This roadmap builds a second, region-aware nutrition layer —
grounded in official Indian and US food-composition science, not AI-estimated — that sits
alongside Spoonacular rather than replacing it, and lays the groundwork for a self-growing
recipe corpus (RAG) on top of that verified data.

**Core principle carried over from the rest of the app:** AI explains and arranges real data;
it never invents a nutrient value. Every number in this system traces back to a source and a
confidence tier.

---

## Canonical nutrient schema

USDA, IFCT, and Open Food Facts each use a different shape for nutrition data. Rather than
have every feature understand all three, one internal shape is defined once and every source
adapts into it:

~25–30 nutrients: calories, protein, carbs, fiber, sugar, fat, saturated fat, sodium,
potassium, calcium, iron, vitamin A/C/D/B12, folate, and similar — a curated set, not the
full 150+ raw USDA panel. This is the only shape the rest of the app ever sees.

---

## Data model

| Table              | Purpose                                                                                                                                                     | Confidence tier                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `ingredients`      | Raw commodities — USDA + IFCT, region-tagged where IFCT provides it, flagged `is_cooked` where IFCT has a pre-composed dish entry                           | 1                                       |
| `branded_products` | Packaged/branded items — Open Food Facts India first, Firecrawl-scraped labels for gaps                                                                     | 2                                       |
| `yield_factors`    | Raw→cooked weight ratios + per-nutrient retention % by ingredient category and cooking method                                                               | reference (feeds tier 3)                |
| `unit_conversions` | Household units (katori, tbsp, piece, roti) → grams, per food-category                                                                                      | reference                               |
| `dish_recipes`     | The recipe corpus (also the pgvector RAG table) — nutrition is a direct IFCT cooked-dish match, or computed by summing resolved ingredients × yield factors | 1, 2, or 3 depending on resolution path |

**Confidence tiers** (tracked per nutrient field, not just per recipe — a dish can have
lab-verified protein and estimated sodium at the same time):

1. Lab-verified official data (USDA Foundation/SR Legacy, ICMR-NIN IFCT)
2. Manufacturer package labels (Open Food Facts, scraped labels)
3. Algorithmic recipe breakdown (raw ingredients summed, retention-adjusted)
4. Estimated fallback (scraped web macros, AI estimate)

---

## Phases

### Phase 1 — Static base layer

**Sources:** USDA FoodData Central + IFCT 2017 via `@ifct2017/compositions` (MIT-licensed,
542 foods — confirmed directly against the installed package's files, not `@nodef/ifct2017`;
see the correction note below)
**Build:** `lib/usda.ts`, `lib/ifct.ts` (same service-layer pattern as `lib/spoonacular.ts`),
adapters into the canonical schema, `ingredients` table + seed scripts
**Infra:** none beyond Supabase
**Status:** built — see `lib/usda.ts`, `lib/ifct.ts`, `supabase/nutrition-phase1-schema.sql`,
`scripts/seed-ingredients-usda.ts`, `scripts/seed-ingredients-ifct.ts`

**Corrections made during Phase 1 build (verified directly against source data, not assumed
from the original research):**

1. **`@nodef/ifct2017` is AGPL-3.0** as of April 2025 — confirmed from its own `package.json`
   and GitHub LICENSE. Using `@ifct2017/compositions` instead (a separate, older MIT-licensed
   package lineage) avoids this entirely, with no data loss: its data file actually contains
   the full 542-food set despite stale "528 foods" text in its own description.
2. **IFCT has no regional breakdown.** It samples from 6 regional compositing centres but
   publishes one national mean per food (plus a standard error) — not six separate
   region-specific values. There is no region to select. The "Region handling" open decision
   below is revised accordingly.
3. **IFCT is almost entirely raw commodities, not composite dishes.** Of 542 entries, only 9
   have any cooked-prep-sounding name (mostly boiled eggs). Phase 5's ingredient-resolution
   engine should not expect many direct cooked-dish matches here, contrary to the original
   research's suggestion.

### Phase 2 — Branded products

**Source:** Open Food Facts India (barcode-indexed, ODbL-licensed)
**Build:** `lib/openfoodfacts.ts`, `branded_products` table
**Infra:** none beyond Supabase

### Phase 3 — Unit conversions

**Why here:** cross-cutting — pantry quantities, recipe scaling, and search all eventually
need "1 katori" / "2 roti" understood. Doing it early avoids retrofitting later phases.
**Build:** `unit_conversions` table, category-aware (a katori of rice ≠ a katori of dal)

### Phase 4 — Firecrawl, narrowed

**Scope:** only what Phases 1–2 don't cover — specific e-commerce SKUs, recipe/restaurant
pages not in Open Food Facts
**Build:** `lib/firecrawl.ts`, same service-layer pattern
**Note:** use plain `/scrape` + Gemini schema-constrained extraction, not Firecrawl's own
`/extract` — cheaper and keeps extraction consistent with the rest of the app's grounding
pattern

### Phase 5 — Ingredient-resolution engine

**The hard one.** Given a dish's ingredient list: check `dish_recipes`/IFCT for a direct
cooked-dish match first (IFCT already includes many prepared dishes, not just raw
commodities); if none exists, resolve each ingredient against `ingredients`, apply
yield/retention factors from `yield_factors`, sum.
**Scope note:** this is a small nutritional-science engine, not a lookup utility — treat as
its own multi-step build, sequenced after Phases 1–3 exist to resolve against.

### Phase 6 — pgvector corpus + embeddings

**Where this reconnects to the RAG plan:** `dish_recipes` gets embeddings (Gemini embedding
model), becomes semantically searchable. Spoonacular results, Firecrawl-scraped recipes, and
eventually user-submitted recipes converge into one corpus, each carrying its own confidence
tier.

### Phase 7 — Confidence-tier UI

Badges surfaced wherever nutrition is shown, extending the app's existing `(AI-suggested)`
badge pattern (already used on substitute suggestions) to all four tiers — per-nutrient, not
just per-recipe.

### Phase 8 — Live fallback + self-growing corpus

Runtime flow: vector search the corpus first → live Firecrawl fallback on a miss → async
embed-and-store backfills the corpus, so the next similar query is served from the fast, free,
already-verified corpus instead of a fresh scrape.

---

## Open decisions (need answers before Phase 1 starts)

1. **Does this replace or supplement Spoonacular's nutrition figures?**
   Leaning: keep Spoonacular for recipe content/instructions, override _nutrition_ with this
   system whenever a confident match exists, fall back to Spoonacular's own number
   (tier-4-labeled) only when nothing resolves.

2. **Region handling — revised.** IFCT does not publish per-region values at all (see the
   Phase 1 correction note above), so there's no region to default away from. If regional
   variation ever matters, the only available signal is each nutrient's standard error across
   the 6 compositing centres (the `_e`-suffixed raw fields — not yet mapped into the canonical
   schema) — e.g. flagging high-variance nutrients as "varies regionally," not offering a
   region picker.

3. **Scope for now vs. later.** This is a multi-session subsystem. Recommended target:
   **Phases 1–3 are the near-term goal** — that alone delivers accurate, region-aware,
   complete nutrition data, which was the original ask. Phases 4–8 are a real but
   longer-horizon roadmap.

---

## Suggested sequence

```
Phase 1 (USDA + IFCT) → Phase 2 (Open Food Facts India) → Phase 3 (unit conversions)
        — near-term target, answers the original ask —

Phase 4 (Firecrawl) → Phase 5 (resolution engine) → Phase 6 (pgvector corpus)
→ Phase 7 (confidence UI) → Phase 8 (live fallback)
        — longer-horizon, builds toward the full RAG system —
```
