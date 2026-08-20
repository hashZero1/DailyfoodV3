import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { CUISINES, DIETS, MEAL_TYPES } from "@/lib/constant";
import type { MissingIngredientExplanation } from "@/types/cookwith";

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

// --- AI Meal Planner (roadmap 6.7) ---

export interface MealPlanCandidate {
  id: number;
  title: string;
  readyInMinutes?: number;
}

export interface GeneratedMealPlanSlot {
  day: number; // 0-6, Monday-Sunday
  mealType: "breakfast" | "lunch" | "dinner";
  recipeId: number;
}

export async function generateMealPlan(params: {
  breakfastCandidates: MealPlanCandidate[];
  mainCandidates: MealPlanCandidate[];
  pantryIngredients: string[];
  notes: string;
}): Promise<GeneratedMealPlanSlot[]> {
  const ai = getClient();

  const contents = [
    `Breakfast candidates (choose only from these ids): ${JSON.stringify(params.breakfastCandidates)}`,
    `Lunch/dinner candidates (choose only from these ids — the same pool serves both lunch and dinner, but avoid repeating a recipe twice in the same day): ${JSON.stringify(params.mainCandidates)}`,
    params.pantryIngredients.length > 0
      ? `User's pantry ingredients — prefer candidates that plausibly use these based on their title, when reasonable, but don't force a bad fit: ${params.pantryIngredients.join(", ")}`
      : "",
    params.notes,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction:
        "Build a 7-day meal plan (days numbered 0-6) with breakfast, lunch, and dinner for each day — 21 entries total, one per day per meal type. You MUST only use recipe ids that appear in the provided candidate lists — never invent an id. Maximize variety: avoid repeating the same recipe more than once across the week wherever the pool size allows it.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.NUMBER },
            mealType: { type: Type.STRING },
            recipeId: { type: Type.NUMBER },
          },
          required: ["day", "mealType", "recipeId"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as GeneratedMealPlanSlot[];
}

// --- "Cook With What I Have" (roadmap 6.3) ---

export async function normalizeIngredients(
  description: string,
): Promise<string[]> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: description,
    config: {
      systemInstruction:
        "Extract the distinct food ingredients the user says they have, in canonical singular form suitable for a recipe-ingredient search (e.g. 'half an onion' -> 'onion', 'some leftover rice' -> 'rice', 'two chicken breasts' -> 'chicken breast'). Drop quantities, qualifiers, and anything that isn't a food ingredient. Return only ingredients actually mentioned — never add ones the user didn't say.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as string[];
}

export async function explainMissingIngredients(
  recipeTitle: string,
  missingIngredients: string[],
): Promise<MissingIngredientExplanation[]> {
  if (missingIngredients.length === 0) return [];

  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Recipe: ${recipeTitle}\nMissing ingredients: ${missingIngredients.join(", ")}`,
    config: {
      systemInstruction:
        "For each missing ingredient listed below (and ONLY those — never add or drop any), write one brief sentence (under 20 words) on its role in the dish, and suggest one practical, commonly-available substitute if a reasonable one exists, otherwise null.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            explanation: { type: Type.STRING },
            substitute: { type: Type.STRING, nullable: true },
          },
          required: ["name", "explanation", "substitute"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as MissingIngredientExplanation[];
}
