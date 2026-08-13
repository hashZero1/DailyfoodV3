import "server-only";
import { supabase } from "@/lib/supabase";

export interface FavoriteRecord {
  id: string;
  recipe_id: number;
  title: string;
  image: string | null;
  created_at: string;
}

export async function listFavorites(userId: string): Promise<FavoriteRecord[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("id, recipe_id, title, image, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function addFavorite(
  userId: string,
  recipe: { id: number; title: string; image?: string }
): Promise<void> {
  const { error } = await supabase.from("favorites").upsert(
    {
      user_id: userId,
      recipe_id: recipe.id,
      title: recipe.title,
      image: recipe.image ?? null,
    },
    { onConflict: "user_id,recipe_id" }
  );

  if (error) throw new Error(error.message);
}

export async function removeFavorite(
  userId: string,
  recipeId: number
): Promise<void> {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipeId);

  if (error) throw new Error(error.message);
}
