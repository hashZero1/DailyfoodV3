import { NextRequest, NextResponse } from "next/server";
import { getRecipeById } from "@/lib/spoonacular";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipeId = Number(id);

  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return NextResponse.json({ message: "Invalid recipe id" }, { status: 400 });
  }

  try {
    const recipe = await getRecipeById(recipeId);
    return NextResponse.json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe not found";
    return NextResponse.json({ message }, { status: 404 });
  }
}
