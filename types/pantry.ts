export interface PantryItemRecord {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  expires_at: string | null; // ISO date, e.g. "2026-08-20"
  low_stock_threshold: number | null;
  created_at: string;
}

export interface PantryItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  expiresAt?: string | null;
  lowStockThreshold?: number | null;
}
