"use server";

import { parseNaturalLanguageQuery } from "@/lib/gemini";
import type { ParsedSearchQuery } from "@/lib/gemini";

export type ParseQueryResult =
  | { ok: true; filters: ParsedSearchQuery }
  | { ok: false; message: string };

export async function parseSearchQueryAction(
  input: string,
): Promise<ParseQueryResult> {
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
