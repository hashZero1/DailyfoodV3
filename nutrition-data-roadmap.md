# Regional Nutrition Data Subsystem — Roadmap

_Last updated 12 Nov 2026. Detail on the staged path and its flaw analysis: `rag-roadmap-review.md`. Setup and file map: `README-nutrition.md`._

## Why this exists

Spoonacular's recipe data and nutrition figures are US/global-commodity-centric and capped
to whatever's in their corpus. This roadmap builds a second, region-aware nutrition layer —
grounded in official Indian and US food-composition science, not AI-estimated — that sits
alongside Spoonacular rather than replacing it, and lays the groundwork for a self-growing
recipe corpus (RAG) on top of that verified data.

**Core principle carried over from the rest of the app:** AI explains and arranges real data;
it never invents a nutrient value. Every number in this system traces back to a source and a
confidence tier. AI may suggest _names_ (reviewable) and, later, choose among candidate IDs
that the verified data already contains; it never supplies a nutrient.

---

## Where we are

| Phase / stage                          | Status                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 1: USDA + IFCT                   | Built. Seeds not yet run against live Supabase                                                     |
| Phase 2: Open Food Facts               | Built. Not verified against live OFF data                                                          |
| Phase 3: unit conversions              | Engine, schema and tests built (13 tests). **No weight rows seeded yet**: waiting on NIN annexures |
| Stage 2: ingredient resolution         | Built and tested offline (resolver core, 12 tests). Golden set 60/61, held-out 16/25, 0 wrong      |
| Stage 2b: common Indian names          | Schema, scoring, display order and enrichment script built. **Script not run live**                |
| Spoonacular storage compliance         | **Open decision** (blocks Stage 3 design and the planned corpus)                                   |
| Phases 4–8 (Firecrawl → live fallback) | Not started                                                                                        |

Nothing in this subsystem has been verified against live services yet (the build sandbox could
not reach Supabase, USDA, Open Food Facts or nin.res.in). **Stage 0 is therefore the next real
gate**, ahead of any new building.

---

## Canonical nutrient schema

USDA, IFCT, and Open Food Facts each use a different shape for nutrition data. Rather than
have every feature understand all three, one internal shape is defined once and every source
adapts into it: **27 nutrients per 100 g** (calories, protein, carbs, fiber, sugar, fat,
saturated and trans fat, cholesterol, sodium, potassium, calcium, iron, magnesium, zinc,
phosphorus, vitamins A/C/D/E/K/B12, folate, thiamin, riboflavin, niacin, B6). Null means "not
measured", never zero. This is the only shape the rest of the app sees.

---

## Data model

| Table                         | Purpose                                                                                                             | Confidence tier |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------- |
| `ingredients`                 | Raw commodities, USDA + IFCT. Also holds `food_group`, `aliases`, `scientific_name`, `common_name`, `also_known_as` | 1               |
| `branded_products`            | Packaged items, Open Food Facts India first, Firecrawl-scraped labels for gaps                                      | 2               |
| `unit_definitions`            | What a unit is (katori = 225 ml, roti is a count unit), each with a basis and source                                | reference       |
| `unit_conversions`            | Grams per unit, or a density, per ingredient or IFCT food group and state (raw/cooked). Every row needs a source    | reference       |
| `ingredient_name_suggestions` | User-proposed names for a food. Pending until approved; not yet used                                                | n/a             |
| `yield_factors`               | Raw→cooked ratios, per-nutrient retention, and an explicit oil-uptake assumption (not built)                        | reference       |
| `dish_recipes`                | Recipe corpus and the pgvector table (not built)                                                                    | 1, 2, 3 or 4    |

**Confidence tiers** (tracked per nutrient, not just per recipe — a dish can have
lab-verified protein and estimated sodium at the same time):

1. Lab-verified official data (USDA Foundation/SR Legacy, ICMR-NIN IFCT)
2. Manufacturer package labels (Open Food Facts, scraped labels)
3. Algorithmic recipe breakdown (resolved ingredients summed, retention-adjusted). A summed dish is tier 3 even if every ingredient is tier 1
4. Estimated fallback (scraped web macros, AI estimate)

---

## Phases

### Phase 1: Static base layer (built)

**Sources:** USDA FoodData Central + IFCT 2017 via `@ifct2017/compositions` (MIT, 542 foods;
not `@nodef/ifct2017`, which is AGPL-3.0 since April 2025).
**Built:** `lib/usda.ts`, `lib/ifct.ts`, adapters into the canonical schema, `ingredients`
table (`unique (source, source_id)`), seed scripts.

**Corrections found along the way:**

1. **`@nodef/ifct2017` is AGPL-3.0**; the MIT package has the full 542-food set despite its stale "528" description.
2. **IFCT has no regional breakdown.** One national mean per food plus a standard error. There is no region to select.
3. **IFCT is raw commodities, not dishes.** About 9 of 542 names sound cooked, mostly boiled eggs. Do not expect direct cooked-dish matches.
4. **USDA search and detail endpoints return different shapes** (flat vs nested); the mapper handles both, with an Atwater energy fallback. Unverified live.
5. **A unique key including a null `region` never conflicts**, so re-seeding duplicated rows. Changed to `unique (source, source_id)`.

### Phase 2: Branded products (built)

**Source:** Open Food Facts (ODbL). Search via `in.openfoodfacts.org` (v1 `cgi/search.pl`; v2 has
no free text), barcode lookups via `world.openfoodfacts.org`. **Built:** `lib/openfoodfacts.ts`,
`lib/branded-products.ts` (lazy cache-on-lookup, no bulk seed), `branded_products` table.
Crowd-sourced, so each nutrient's unit is read from its own `_unit` field. Set a real contact in
the `USER_AGENT` before shipping.

### Phase 3: Unit conversions (engine built, data pending)

`lib/unit-conversions-core.ts` (pure, tested) and `lib/unit-conversions.ts` (Supabase loader).
Lookup order: ingredient row, then IFCT food-group row, then density × unit volume. State
(raw/cooked) must be supplied when rules differ, otherwise `state_required`; it never guesses.
Results report their `basis` (published, user-defined, derived, assumed). Katori is 225 ml (the
owner's 200–250 ml midpoint). **No weight is seeded without a citable source**; the target is
ICMR-NIN _Dietary Guidelines for Indians 2024_, Annexures I–II (image-based PDF, needs the pages
supplied). Pending: a sourced piece weight for "1 egg".

### Stage 2: Ingredient resolution (built, offline-verified)

`resolveIngredient("2 tbsp chopped coriander leaves")` parses quantity, unit and name, then ranks
`ingredients` by exact name, the name before the comma, IFCT local names (aliases) and the
common name. Outcomes: `resolved`, `ambiguous` (with candidate IDs), `unresolved`. Never a
nearest-food guess.

- Reviewed, hand-maintained data in the core: `SYNONYMS`, `ALIAS_DENYLIST` (IFCT lists "Oat" under refined wheat flour), `NEGLIGIBLE` (water), `DEFAULT_PICKS`.
- **`DEFAULT_PICKS`** (owner policy): bare ambiguous words resolve to a chosen food, only if that food is already among the matched candidates. egg → whole egg, milk → cow milk (note: "cow milk preferred for better results"), plus rice, onion, tomato (to be reviewed).
- **Measured:** `scripts/eval-ingredient-resolution.ts` on a 59-line golden set it was tuned against, and a 25-line held-out set it was not. Treat the held-out figure as the honest one.
- **Not built:** the Gemini tie-break. For an ambiguous line, Gemini would be shown only the candidate IDs (real `ingredients` rows), must answer with one of them via schema-constrained output, and the server rejects any ID not on the list. Needs a go-ahead.

### Stage 2b: Common Indian names (built, enrichment not run)

Display order: common name, then "also known as", then the official source name
(`Bhindi · also known as Okra, Vendakkai · official: Ladies finger`). `common_name` also
matches like the official name. `scripts/enrich-common-names.ts` asks Gemini with search
grounding, writes `data/common-names.json` for review, and saves rows as AI-suggested and
unreviewed; reviewed or user names are never overwritten. User-suggested names come with the UI
later, via `ingredient_name_suggestions`.

### Stage 3 (old Phase 5): `resolveRecipeNutrition()` (not started)

Given resolved ingredients and grams, sum per nutrient with null-aware math and return
`{ value, tier, sources, coverage }` per nutrient. Reframed from the earlier plan:

- Recipe totals do not need cooked-weight yield. Yield matters for portion conversion (1 katori cooked dal → raw grams). What moves nutrition is vitamin retention and **oil/ghee absorbed in frying**, so the oil assumption must be explicit and visible.
- Retention starting point: USDA Table of Nutrient Retention Factors, Release 6, plus a hand-built Indian-cooking supplement.
- Define the interface first with a Spoonacular-backed implementation (computed and displayed, **not stored**), then swap in the own engine.
- Then wire into AI recipe modification: Gemini returns a schema-constrained ingredient list, the engine recomputes, the UI shows verified totals.
- Exit check: macro error against the golden set within a threshold chosen up front.

### Stage 4 (old Phase 7): Confidence-tier badges

Ship badges the moment any computed number appears, extending the `(AI-suggested)` pattern to
all four tiers, per nutrient. Do not show engine numbers unlabelled and add badges later.

### Stage 5 (old Phase 6): pgvector corpus and search

`dish_recipes` with `source`, `license`, `owner_user_id`, `visibility`, `parent_recipe_id`,
`ingredient_ids` (GIN) and one profile embedding (`gemini-embedding-001`, reduced to fit pgvector's
2000-dimension index limit). Replace `recipe_id integer` with a source-qualified `recipe_ref`
(`spoonacular:716429`, `corpus:<uuid>`). Hybrid search: filters + full text + vector, fused with
RRF. The corpus cannot hold Spoonacular content beyond ID, title and image.

### Stage 6 (old Phases 4 + 8): Scraping fallback and self-growing corpus

Firecrawl `/scrape` with Gemini schema-constrained extraction (not Firecrawl's `/extract`),
structured fields only, dedup by ingredient-set identity (variants stay variants), moderation
queue, per-site terms check, spend caps. Runtime: search the corpus, fall back to a live scrape
on a miss, then embed and store.

---

## Staged path and exit checks

Do not start the next stage until the current one's check passes.

| Stage                         | Exit check                                                                                             | State                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 0: stabilize (live)           | Seeds idempotent on re-run; 10 USDA rows and 5 real Indian barcodes sane; Spoonacular question settled | **Next. Not started**            |
| 1: unit conversions           | "1 katori cooked rice", "2 roti", "1 tbsp ghee" convert with a cited source                            | Engine done, **data pending**    |
| 2 / 2b: resolution and names  | Measured resolution rate on the golden set, failures listed                                            | Done offline; names not run live |
| 3: `resolveRecipeNutrition()` | Macro error within a pre-chosen threshold                                                              | Blocked on Spoonacular decision  |
| 4: badges                     | No computed number shown unlabelled                                                                    | Not started                      |
| 5: corpus and search          | Retrieval check set passes                                                                             | Not started                      |
| 6: scraping and growth        | Moderation and spend caps in place                                                                     | Not started                      |

**Independent tracks:** production readiness (RLS verification, error boundaries, Auth0 prod
config, Spoonacular quota handling, deployment, SEO/accessibility); voice cooking assistant (P2).

---

## Decisions

**Settled**

1. **Spoonacular vs this system for nutrition:** override with this system when a confident match exists, fall back to Spoonacular's number (tier 4) otherwise.
2. **Region handling:** moot, IFCT has no regions. The standard error could later flag high-variance nutrients as "varies regionally"; no region picker.
3. **Katori size:** 225 ml.
4. **Names:** most common Indian name first, then "also known as", then the official English name. Users can suggest names later.
5. **Defaults:** whole egg for "egg", cow milk for "milk" (with a note), plus the rice/onion/tomato picks above.

**Open**

1. **Where do corpus recipes come from?** Spoonacular's terms block the planned corpus: only recipe ID, title and image URL may be stored; ingredients, instructions and nutrition may not; caching needs written permission, capped at 1 hour; everything must be deleted if the API is dropped. Options: user-submitted, self-authored, a licensed dataset, or scraped with a legal read.
2. **Is the `meal_plan_entries` nutrition snapshot covered by your Spoonacular terms?** Either draft the permission email or change the snapshot code to store IDs only.
3. **Ship a Spoonacular-backed `resolveRecipeNutrition()` first** (faster, tier 4) or wait for the own engine before AI recipe modification?
4. **Gemini tie-break** for ambiguous lines: build it or not?
5. **NIN Annexure I and II pages**, to seed real weights.

---

## Suggested sequence

```
Stage 0 (verify live) → Stage 1 (seed real unit weights) → Stage 2/2b (done offline)
        — near-term: accurate, region-aware, complete nutrition data —

Stage 3 (recipe nutrition) → Stage 4 (badges) → Stage 5 (corpus) → Stage 6 (scraping, growth)
        — longer-horizon, builds toward the full RAG system —
```
