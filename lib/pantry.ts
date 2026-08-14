import "server-only";
import { supabase } from "@/lib/supabase";
import type { PantryItemRecord, PantryItemInput } from "@/types/pantry";

const COLUMNS =
  "id, name, quantity, unit, category, expires_at, low_stock_threshold, created_at";

export async function listPantryItems(
  userId: string,
): Promise<PantryItemRecord[]> {
  const { data, error } = await supabase
    .from("pantry_items")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addPantryItem(
  userId: string,
  item: PantryItemInput,
): Promise<PantryItemRecord> {
  const { data, error } = await supabase
    .from("pantry_items")
    .insert({
      user_id: userId,
      name: item.name,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      category: item.category ?? null,
      expires_at: item.expiresAt ?? null,
      low_stock_threshold: item.lowStockThreshold ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePantryItemQuantity(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const { error } = await supabase
    .from("pantry_items")
    .update({ quantity: Math.max(0, quantity) })
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function deletePantryItem(
  userId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pantry_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}
