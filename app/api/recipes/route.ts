import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchRecipes } from "@/lib/spoonacular";

const searchParamsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  cuisine: z.string().trim().max(100).optional(),
  diet: z.string().trim().max(100).optional(),
  intolerances: z.string().trim().max(200).optional(),
  maxReadyTime: z.coerce.number().int().positive().max(600).optional(),
  type: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  number: z.coerce.number().int().min(1).max(50).default(12),
});

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = searchParamsSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid search parameters", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { offset, number, ...filters } = parsed.data;

  try {
    const results = await searchRecipes(filters, offset, number);
    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ message }, { status: 502 });
  }
}
