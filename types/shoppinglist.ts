export interface ShoppingListItemRecord {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  source: string | null;
  created_at: string;
}
