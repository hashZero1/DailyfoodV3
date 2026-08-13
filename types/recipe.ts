// Types are deliberately shaped after Spoonacular's actual response fields
// (not the whole payload — just what the UI uses). Extend as new fields
// are needed rather than typing the entire Spoonacular schema up front.

export interface RecipeSummary {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
}

export interface RecipeIngredient {
  id: number;
  name: string;
  amount: number;
  unit: string;
  original: string;
}

export interface RecipeNutrient {
  name: string;
  amount: number;
  unit: string;
}

export interface RecipeDetail extends RecipeSummary {
  summary?: string; // HTML from Spoonacular — sanitize before rendering
  instructions?: string; // HTML from Spoonacular — sanitize before rendering
  extendedIngredients?: RecipeIngredient[];
  nutrition?: {
    nutrients: RecipeNutrient[];
  };
  diets?: string[];
  cuisines?: string[];
  dishTypes?: string[];
}

export interface SearchFilters {
  query?: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  maxReadyTime?: number;
  type?: string; // meal type: main course, dessert, etc.
}

export interface SearchResult {
  results: RecipeSummary[];
  totalResults: number;
  offset: number;
  number: number;
}
