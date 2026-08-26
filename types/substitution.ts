export interface IngredientSubstitution {
  name: string;
  tasteTextureChange: string;
  materiallyChanges: boolean;
  source: "spoonacular" | "ai";
}
