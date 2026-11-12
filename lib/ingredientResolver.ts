import { isKnownUnitAlias, normalizeUnit } from "./unitAnalysis";

// Stage 2 — ingredient resolution, pure logic (no DB, no server-only).
// Turns a free-text line ("2 tbsp chopped coriander leaves") into a quantity,
// a unit, and a ranked set of `ingredients` candidates, with an explicit
// outcome: resolved / ambiguous / unresolved. Never guesses: a line that does
// not match confidently is returned as ambiguous (with candidates) or
// unresolved, never silently mapped to the nearest food.

export interface IngredientCandidate {
  id?: string;
  source: string;
  source_id: string;
  canonical_name: string;
  aliases?: string[] | null;
  scientific_name?: string | null;
  food_group?: string | null;
  common_name?: string | null; // most common name used in India (AI-suggested, reviewable)
  also_known_as?: string[] | null;
}

export interface ParsedLine {
  raw: string;
  quantity: number | null; // null when absent or a range ("2-3") — never guessed
  quantity_is_range: boolean;
  unit: string | null; // normalized; may be a unit we cannot convert (inch, pinch)
  name: string; // what is left after quantity/unit/descriptors
  state: "raw" | "cooked" | null;
}

export type ResolveOutcome =
  | {
      status: "resolved";
      match: ScoredCandidate;
      alternatives: ScoredCandidate[];
      // Set when the pick came from DEFAULT_PICKS rather than an unambiguous match.
      default_note?: string;
    }
  | { status: "ambiguous"; candidates: ScoredCandidate[] }
  | {
      status: "unresolved";
      reason: "empty" | "no_match" | "weak_match" | "negligible";
    };

export interface ScoredCandidate {
  candidate: IngredientCandidate;
  score: number;
  matched_on: "common_name" | "name" | "name_head" | "alias";
  matched_text: string;
}

// ---- parsing -------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
};

// Units the parser should peel off even though they have no gram conversion.
// They stay in `unit`; toGrams() will report unknown_unit rather than guess.
const EXTRA_UNITS = new Set([
  "inch",
  "inches",
  "pinch",
  "pinches",
  "dash",
  "sprig",
  "sprigs",
  "bunch",
  "bunches",
  "handful",
  "clove",
  "cloves",
  "slice",
  "slices",
]);

// Preparation/size words that describe the cut, not the food. Deliberately
// short: words that appear inside IFCT names (ground, big, small, dry,
// powder, flour, raw, boiled...) are NOT here.
const DESCRIPTORS = new Set([
  "chopped",
  "sliced",
  "diced",
  "minced",
  "grated",
  "crushed",
  "peeled",
  "finely",
  "roughly",
  "fresh",
  "freshly",
  "large",
  "medium",
  "of",
  "a",
  "an",
  "the",
  "to",
  "taste",
  "optional",
  "for",
  "garnish",
  "and",
  "or",
  "as",
  "needed",
]);

const COOKED_WORDS = new Set([
  "cooked",
  "boiled",
  "steamed",
  "fried",
  "roasted",
  "baked",
]);

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("ss") || w.endsWith("us")) return w;
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Tokens used for matching. `dropDescriptors` is for query text only. */
export function tokenize(s: string, dropDescriptors = false): string[] {
  const out: string[] = [];
  for (const w of normalizeText(s).split(" ")) {
    if (!w) continue;
    if (dropDescriptors && DESCRIPTORS.has(w)) continue;
    out.push(singular(w));
  }
  return out;
}

function parseNumber(tok: string): number | null {
  const t = UNICODE_FRACTIONS[tok] ?? tok;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const f = t.match(/^(\d+)\/(\d+)$/);
  if (f && Number(f[2]) !== 0) return Number(f[1]) / Number(f[2]);
  return null;
}

export function parseIngredientLine(line: string): ParsedLine {
  let rest = line
    .trim()
    .replace(/[½¼¾⅓⅔⅛]/g, (m) => ` ${UNICODE_FRACTIONS[m]} `);
  // "200g" -> "200 g"
  rest = rest.replace(/^(\d+(?:\.\d+)?)([a-zA-Z]+)/, "$1 $2");
  // drop trailing ", chopped" style notes and parentheses
  rest = rest
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const toks = rest.split(" ");
  let quantity: number | null = null;
  let isRange = false;
  let i = 0;

  const rangeTok = toks[0]?.match(
    /^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)$/,
  );
  if (rangeTok) {
    isRange = true;
    i = 1;
  } else if (
    toks[0] &&
    toks[1] === "to" &&
    parseNumber(toks[0]) !== null &&
    toks[2] &&
    parseNumber(toks[2]) !== null
  ) {
    isRange = true;
    i = 3;
  } else {
    const first = toks[0] ? parseNumber(toks[0]) : null;
    if (first !== null) {
      quantity = first;
      i = 1;
      // mixed number "1 1/2"
      const second = toks[1] ? parseNumber(toks[1]) : null;
      if (second !== null && toks[1].includes("/")) {
        quantity = first + second;
        i = 2;
      }
    }
  }

  let unit: string | null = null;
  if ((quantity !== null || isRange) && toks[i]) {
    const cand = toks[i].toLowerCase().replace(/[.,]+$/, "");
    if (isKnownUnitAlias(cand) || EXTRA_UNITS.has(cand)) {
      unit = isKnownUnitAlias(cand) ? normalizeUnit(cand) : cand;
      i++;
    }
  }
  if (toks[i]?.toLowerCase() === "of") i++;

  const name = toks
    .slice(i)
    .join(" ")
    .replace(/\s*,\s*/g, " ")
    .trim();
  const words = new Set(normalizeText(name).split(" "));
  const state = [...words].some((w) => COOKED_WORDS.has(w))
    ? "cooked"
    : words.has("raw")
      ? "raw"
      : null;

  return { raw: line, quantity, quantity_is_range: isRange, unit, name, state };
}

// ---- local names ---------------------------------------------------------

/**
 * IFCT `lang` looks like "A. Moricha guti; H. Ramdana; Kan. Danthu beeja;
 * A., Kash. Baajra; E. Pearl millet." — language-code prefix, then the name.
 * Returns the names without prefixes, de-duplicated.
 */
export function parseLocalNames(lang: string | null | undefined): string[] {
  if (!lang) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // Entries split on ";" and also on "," ("Okra, Okro, Ochro" is three names).
  // "A., Kash. Baajra": a comma right after a language code is part of the prefix.
  for (const part of lang
    .replace(/\b([A-Z][a-z]{0,3})\.,/g, "$1.")
    .split(/[;,]/)) {
    const name = part
      .trim()
      .replace(/^(?:[A-Z][a-z]{0,3}\.\s+(?=\S))+/, "")
      .replace(/\.+$/, "")
      .trim();
    const key = normalizeText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// ---- reviewed data: synonyms, bad aliases, non-ingredients ---------------

// Query-side rewrites for names IFCT does not carry. Hand-maintained; every
// line is something a person decided. Applied to normalized text, in order.
const SYNONYMS: [RegExp, string][] = [
  [/\b(?:toor|tur|tuvar|arhar) dal\b/, "red gram dal"],
  [/\bchana dal\b/, "bengal gram dal"],
  [/\burad dal\b/, "black gram dal"],
  [/\b(?:masoor|masur) dal\b/, "lentil dal"],
  [/\bmoong dal\b/, "green gram dal"],
  [/\b(ragi|bajra|jowar|nachni) (?:flour|atta|powder)\b/, "$1"],
  [/\b(?:sooji|rava|rawa)\b/, "suji"],
  [/\bsemolina\b/, "wheat semolina"],
];

// Aliases in the source data that are wrong or misleading for matching, as
// "SOURCE_ID|normalized alias". "Oat" is listed under refined wheat flour in
// IFCT's local-name field; "Masur" (lentil) is listed under pigeon pea.
const ALIAS_DENYLIST = new Set(["A018|oat", "B021|masur"]);

// Owner-decided defaults for bare words that match several real foods equally.
// Keyed by the normalized query (after synonyms). The pick is used only when it is
// one of the candidates the line already matched, so a default can never smuggle in
// a food the text did not match. `note` is for the UI. Review and extend freely.
export const DEFAULT_PICKS: Record<
  string,
  { source_id: string; note: string }
> = {
  egg: { source_id: "M001", note: "Whole egg, raw (1 egg)" },
  "boiled egg": { source_id: "M004", note: "Whole egg, boiled (1 egg)" },
  milk: {
    source_id: "L002",
    note: "Milk (cow milk preferred for better results)",
  },
  rice: { source_id: "A015", note: "Raw milled rice (white)" },
  onion: { source_id: "G017", note: "Onion, big" },
  tomato: { source_id: "D075", note: "Tomato, ripe (hybrid)" },
};

// Not nutritionally meaningful here; reported explicitly, not as a failed match.
const NEGLIGIBLE = new Set(["water", "ice", "ice cube"]);

function applySynonyms(name: string): string {
  let t = normalizeText(name);
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep);
  return t;
}

// An alias that is exactly another food's own name (or name before the comma)
// belongs to that food: "Cauliflower" is a local name on "Cauliflower leaves"
// but the primary name of "Cauliflower". Suppress it on the non-owner.
const indexCache = new WeakMap<IngredientCandidate[], IngredientCandidate[]>();

export function cleanAliases(
  candidates: IngredientCandidate[],
): IngredientCandidate[] {
  const hit = indexCache.get(candidates);
  if (hit) return hit;
  const owners = new Map<string, Set<string>>();
  const own = (key: string, id: string) => {
    if (!owners.has(key)) owners.set(key, new Set());
    owners.get(key)!.add(id);
  };
  for (const c of candidates) {
    own(tokenize(c.canonical_name).join(" "), c.source_id);
    own(tokenize(c.canonical_name.split(",")[0]).join(" "), c.source_id);
    if (c.common_name) own(tokenize(c.common_name).join(" "), c.source_id);
  }
  const out = candidates.map((c) => ({
    ...c,
    aliases: (c.aliases ?? []).filter((a) => {
      const key = tokenize(a).join(" ");
      if (ALIAS_DENYLIST.has(`${c.source_id}|${normalizeText(a)}`))
        return false;
      const o = owners.get(key);
      return !(o && !o.has(c.source_id));
    }),
  }));
  indexCache.set(candidates, out);
  return out;
}

// ---- scoring -------------------------------------------------------------

const EXACT_NAME = 1.0;
const EXACT_ALIAS = 0.97;
const EXACT_HEAD = 0.92; // query equals the part of the IFCT name before the first comma
const ALIAS_PARTIAL_DISCOUNT = 0.6; // partial alias overlaps are weak evidence

export const RESOLVED_MIN = 0.9;
export const AMBIGUOUS_MIN = 0.7;
const FORM_QUALIFIERS = new Set(["juice", "oil", "water", "extract"]);
const RESOLVE_MARGIN = 0.05;
const MAX_CANDIDATES = 8;

function sameSet(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((t) => sb.has(t));
}

function partialScore(q: string[], p: string[]): number {
  if (q.length === 0 || p.length === 0) return 0;
  const sp = new Set(p);
  const inter = new Set(q.filter((t) => sp.has(t))).size;
  const cov = inter / new Set(q).size;
  const prec = inter / sp.size;
  return cov * 0.6 + prec * 0.25;
}

export function scoreCandidate(
  queryTokens: string[],
  c: IngredientCandidate,
): ScoredCandidate | null {
  let best: ScoredCandidate | null = null;
  const consider = (
    score: number,
    matched_on: ScoredCandidate["matched_on"],
    text: string,
  ) => {
    if (score > 0 && (!best || score > best.score))
      best = { candidate: c, score, matched_on, matched_text: text };
  };

  if (c.common_name) {
    const ct = tokenize(c.common_name);
    if (sameSet(queryTokens, ct))
      consider(EXACT_NAME, "common_name", c.common_name);
    else consider(partialScore(queryTokens, ct), "common_name", c.common_name);
  }

  const nameTokens = tokenize(c.canonical_name);
  if (sameSet(queryTokens, nameTokens))
    consider(EXACT_NAME, "name", c.canonical_name);
  else
    consider(partialScore(queryTokens, nameTokens), "name", c.canonical_name);

  const head = c.canonical_name.split(",")[0];
  if (head !== c.canonical_name && sameSet(queryTokens, tokenize(head))) {
    // "Lemon, juice" is not a lemon: a form qualifier the query lacks keeps the
    // match below the resolve threshold so it surfaces as ambiguous.
    const qualifier = nameTokens.some(
      (t) => FORM_QUALIFIERS.has(t) && !queryTokens.includes(t),
    );
    consider(qualifier ? AMBIGUOUS_MIN + 0.05 : EXACT_HEAD, "name_head", head);
  }

  for (const alias of c.aliases ?? []) {
    const at = tokenize(alias);
    if (sameSet(queryTokens, at)) consider(EXACT_ALIAS, "alias", alias);
    else
      consider(
        partialScore(queryTokens, at) * ALIAS_PARTIAL_DISCOUNT,
        "alias",
        alias,
      );
  }
  return best;
}

export function resolveIngredientName(
  name: string,
  candidates: IngredientCandidate[],
): ResolveOutcome {
  const q = tokenize(applySynonyms(name), true);
  if (q.length === 0) return { status: "unresolved", reason: "empty" };
  if (NEGLIGIBLE.has(q.join(" ")))
    return { status: "unresolved", reason: "negligible" };

  const scored = cleanAliases(candidates)
    .map((c) => scoreCandidate(q, c))
    .filter((s): s is ScoredCandidate => s !== null)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top) return { status: "unresolved", reason: "no_match" };
  if (top.score < AMBIGUOUS_MIN)
    return { status: "unresolved", reason: "weak_match" };

  const second = scored[1];
  if (
    top.score >= RESOLVED_MIN &&
    (!second || top.score - second.score >= RESOLVE_MARGIN)
  ) {
    return { status: "resolved", match: top, alternatives: scored.slice(1, 4) };
  }
  // Everything within the margin of the top, or above the ambiguity floor.
  const pool = scored.filter(
    (s) => s.score >= AMBIGUOUS_MIN && s.score >= top.score - 0.3,
  );

  const def = DEFAULT_PICKS[q.join(" ")];
  const picked =
    def && pool.find((s) => s.candidate.source_id === def.source_id);
  if (picked) {
    return {
      status: "resolved",
      match: picked,
      alternatives: pool.filter((s) => s !== picked).slice(0, 3),
      default_note: def.note,
    };
  }
  return { status: "ambiguous", candidates: pool.slice(0, MAX_CANDIDATES) };
}

export function resolveIngredientLine(
  line: string,
  candidates: IngredientCandidate[],
): { parsed: ParsedLine; outcome: ResolveOutcome } {
  const parsed = parseIngredientLine(line);
  return { parsed, outcome: resolveIngredientName(parsed.name, candidates) };
}

// ---- display ---------------------------------------------------------------

export interface DisplayName {
  primary: string; // most common Indian name, else the official name
  also_known_as: string[]; // never repeats the primary or the official name
  official: string; // official source name (IFCT/USDA), shown last
}

/** Order the UI shows: common name, then "also known as", then the official English name. */
export function displayName(c: IngredientCandidate): DisplayName {
  const primary = c.common_name?.trim() || c.canonical_name;
  const seen = new Set([
    normalizeText(primary),
    normalizeText(c.canonical_name),
  ]);
  const aka: string[] = [];
  for (const n of c.also_known_as ?? []) {
    const k = normalizeText(n);
    if (k && !seen.has(k)) {
      seen.add(k);
      aka.push(n.trim());
    }
  }
  return {
    primary,
    also_known_as: aka.slice(0, 4),
    official: c.canonical_name,
  };
}

export function formatDisplayName(c: IngredientCandidate): string {
  const d = displayName(c);
  const parts = [d.primary];
  if (d.also_known_as.length)
    parts.push(`also known as ${d.also_known_as.join(", ")}`);
  if (normalizeText(d.official) !== normalizeText(d.primary))
    parts.push(`official: ${d.official}`);
  return parts.join(" · ");
}
