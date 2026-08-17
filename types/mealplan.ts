export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlanEntryRecord {
  id: string;
  date: string; // ISO date, "YYYY-MM-DD"
  meal_type: MealType;
  recipe_id: number;
  title: string;
  image: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}
