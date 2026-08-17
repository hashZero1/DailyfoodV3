import "server-only";
import { supabase } from "@/lib/supabase";
import type { MealPlanEntryRecord, MealType } from "@/types/mealplan";

const COLUMNS =
  "id, date, meal_type, recipe_id, title, image, calories, protein_g, carbs_g, fat_g, created_at";

export async function listMealPlanEntries(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<MealPlanEntryRecord[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addMealPlanEntry(
  userId: string,
  entry: {
    date: string;
    mealType: MealType;
    recipeId: number;
    title: string;
    image?: string | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
  },
): Promise<MealPlanEntryRecord> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .insert({
      user_id: userId,
      date: entry.date,
      meal_type: entry.mealType,
      recipe_id: entry.recipeId,
      title: entry.title,
      image: entry.image ?? null,
      calories: entry.calories ?? null,
      protein_g: entry.proteinG ?? null,
      carbs_g: entry.carbsG ?? null,
      fat_g: entry.fatG ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMealPlanEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) throw new Error(error.message);
}
