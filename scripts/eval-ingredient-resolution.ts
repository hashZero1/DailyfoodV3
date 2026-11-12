/**
 * Measures the ingredient resolver against the hand-written golden set.
 * Usage: npx tsx scripts/eval-ingredient-resolution.ts [data/ingredient-holdout.json]
 * Offline: uses ifct-ingredients-seed.json, no Supabase. Prints failures; never hides them.
 */
import { readFileSync } from "node:fs";
import {
  resolveIngredientLine,
  type IngredientCandidate,
} from "../lib/ingredientResolver";

type Case =
  | { line: string; expect: "resolved"; code: string }
  | { line: string; expect: "ambiguous"; among: string[] }
  | { line: string; expect: "unresolved" };

const rows = JSON.parse(
  readFileSync("ifct-ingredients-seed.json", "utf8"),
) as IngredientCandidate[];
const goldenFile = process.argv[2] ?? "data/ingredient-golden.json";
const golden = JSON.parse(readFileSync(goldenFile, "utf8")).cases as Case[];

let pass = 0;
const wrong: string[] = []; // confidently resolved to the wrong food: the dangerous kind
const missed: string[] = []; // safe failures: ambiguous/unresolved when a clear answer existed

for (const c of golden) {
  const { outcome } = resolveIngredientLine(c.line, rows);
  const got =
    outcome.status === "resolved"
      ? `resolved ${outcome.match.candidate.source_id} (${outcome.match.candidate.canonical_name}, ${outcome.match.score.toFixed(2)} via ${outcome.match.matched_on}: "${outcome.match.matched_text}")`
      : outcome.status === "ambiguous"
        ? `ambiguous [${outcome.candidates.map((x) => x.candidate.source_id).join(",")}]`
        : `unresolved (${outcome.reason})`;

  let ok = false;
  if (c.expect === "resolved")
    ok =
      outcome.status === "resolved" &&
      outcome.match.candidate.source_id === c.code;
  else if (c.expect === "unresolved") ok = outcome.status === "unresolved";
  else {
    const ids =
      outcome.status === "ambiguous"
        ? outcome.candidates.map((x) => x.candidate.source_id)
        : [];
    ok =
      outcome.status === "ambiguous" && c.among.every((a) => ids.includes(a));
  }
  if (ok) {
    pass++;
    continue;
  }
  const msg = `${c.line}\n    expected ${c.expect}${"code" in c ? " " + c.code : ""}\n    got      ${got}`;
  (outcome.status === "resolved" ? wrong : missed).push(msg);
}

console.log(
  `Golden set: ${pass}/${golden.length} correct (${((100 * pass) / golden.length).toFixed(0)}%)`,
);
console.log(`\nWRONG RESOLUTIONS (${wrong.length}) — confident but incorrect:`);
wrong.forEach((m) => console.log("  " + m));
console.log(
  `\nSAFE MISSES (${missed.length}) — flagged ambiguous/unresolved instead:`,
);
missed.forEach((m) => console.log("  " + m));
