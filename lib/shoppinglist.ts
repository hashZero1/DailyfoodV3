import "server-only";
import { supabase } from "@/lib/supabase";
import type { ShoppingListItemRecord } from "@/types/shoppinglist";

const COLUMNS = "id, name, quantity, unit, checked, source, created_at";

export async function listShoppingListItems(
  userId: string,
): Promise<ShoppingListItemRecord[]> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addShoppingListItem(
  userId: string,
  item: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    source?: string | null;
  },
): Promise<ShoppingListItemRecord> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      user_id: userId,
      name: item.name,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      source: item.source ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function matchKey(name: string, unit: string | null): string {
  return `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
}

// Merges a batch of ingredients into the user's list: an item combines
// with an existing *unchecked* item of the same name+unit (summing
// quantity) rather than creating a duplicate row. This is what makes
// "generate from recipe/plan" produce a deduplicated list instead of
// one line per ingredient per recipe.
export async function mergeIntoShoppingList(
  userId: string,
  items: {
    name: string;
    quantity: number | null;
    unit: string | null;
    source?: string | null;
  }[],
): Promise<void> {
  const existing = await listShoppingListItems(userId);

  for (const item of items) {
    const key = matchKey(item.name, item.unit);
    const match = existing.find(
      (e) => !e.checked && matchKey(e.name, e.unit) === key,
    );

    if (match) {
      const newQuantity = (match.quantity ?? 0) + (item.quantity ?? 0);
      const { error } = await supabase
        .from("shopping_list_items")
        .update({ quantity: newQuantity })
        .eq("id", match.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      match.quantity = newQuantity; // keep in sync for the rest of this batch
    } else {
      const created = await addShoppingListItem(userId, item);
      existing.push(created);
    }
  }
}

export async function toggleShoppingListItem(
  userId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ checked })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteShoppingListItem(
  userId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function clearCheckedItems(userId: string): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", userId)
    .eq("checked", true);

  if (error) throw new Error(error.message);
}
