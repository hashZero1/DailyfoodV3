export interface RecipeExplanation {
  summary: string;
  ingredientNotes: { name: string; explanation: string }[];
  stepTips: { stepNumber: number; tip: string }[];
  beginnerVersion: string;
}
