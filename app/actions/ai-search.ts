"use server";

import { parseNaturalLanguageQuery } from "@/lib/gemini";
import type { ParsedSearchQuery } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/ratelimit";

export type ParseQueryResult =
  | { ok: true; filters: ParsedSearchQuery }
  | { ok: false; message: string };

export async function parseSearchQueryAction(
  input: string,
): Promise<ParseQueryResult> {
  const rateLimit = await checkAiRateLimit();
  if (rateLimit.limited) {
    return { ok: false, message: rateLimit.message };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "Type something to search for." };
  }

  try {
    const filters = await parseNaturalLanguageQuery(trimmed);
    return { ok: true, filters };
  } catch (error) {
    console.error("parseSearchQueryAction failed:", error);
    return {
      ok: false,
      message:
        "Couldn't understand that — try rephrasing, or use the filters below.",
    };
  }
}
