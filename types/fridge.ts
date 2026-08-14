export interface FridgeMatchIngredient {
  id: number;
  name: string;
  image?: string;
}

export interface FridgeMatchRecipe {
  id: number;
  title: string;
  image?: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: FridgeMatchIngredient[];
  matchPercent: number;
}
