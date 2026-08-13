import { NextRequest, NextResponse } from "next/server";
import { getRandomRecipes } from "@/lib/spoonacular";

export async function GET(request: NextRequest) {
  const numberParam = request.nextUrl.searchParams.get("number");
  const number = Math.min(Math.max(Number(numberParam) || 10, 1), 20);

  try {
    const data = await getRandomRecipes(number);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch recipes";
    return NextResponse.json({ message }, { status: 502 });
  }
}
