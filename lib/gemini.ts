import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { CUISINES, DIETS, MEAL_TYPES } from "@/lib/constant";

// Structured extraction, not open-ended reasoning — Flash-Lite is fast
// and cheap, no need for a heavier model. Swap this string if desired.
const MODEL = "gemini-3.5-flash-lite";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface ParsedSearchQuery {
  query: string | null;
  cuisine: string | null;
  diet: string | null;
  type: string | null;
  maxReadyTime: number | null;
  maxCalories: number | null;
  minProtein: number | null;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    query: {
      type: Type.STRING,
      nullable: true,
      description:
        "Core dish or ingredient keywords, e.g. 'chicken curry'. Null if none.",
    },
    cuisine: { type: Type.STRING, nullable: true },
    diet: { type: Type.STRING, nullable: true },
    type: { type: Type.STRING, nullable: true, description: "Meal type" },
    maxReadyTime: { type: Type.NUMBER, nullable: true, description: "Minutes" },
    maxCalories: { type: Type.NUMBER, nullable: true },
    minProtein: { type: Type.NUMBER, nullable: true, description: "Grams" },
  },
  required: [
    "query",
    "cuisine",
    "diet",
    "type",
    "maxReadyTime",
    "maxCalories",
    "minProtein",
  ],
};

function buildSystemInstruction(): string {
  return [
    "You translate a home cook's natural-language recipe request into a structured search query.",
    "Only extract constraints the user actually stated — never invent or assume ones they didn't mention. Use null for anything unspecified.",
    `Valid cuisine values (pick the closest match, or null): ${CUISINES.join(", ")}.`,
    `Valid diet values (pick the closest match, or null): ${DIETS.join(", ")}.`,
    `Valid meal type values (pick the closest match, or null): ${MEAL_TYPES.join(", ")}.`,
  ].join(" ");
}

export async function parseNaturalLanguageQuery(
  input: string,
): Promise<ParsedSearchQuery> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: input,
    config: {
      systemInstruction: buildSystemInstruction(),
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return JSON.parse(text) as ParsedSearchQuery;
}
