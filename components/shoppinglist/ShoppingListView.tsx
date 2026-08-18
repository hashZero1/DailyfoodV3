"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addManualItemAction,
  toggleShoppingListItemAction,
  deleteShoppingListItemAction,
  clearCheckedItemsAction,
} from "@/app/actions/shoppinglist";
import type { ShoppingListItemRecord } from "@/types/shoppinglist";

export function ShoppingListView({
  initialItems,
}: {
  initialItems: ShoppingListItemRecord[];
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  const toggle = (item: ShoppingListItemRecord) => {
    const next = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: next } : i)),
    );
    startTransition(async () => {
      try {
        await toggleShoppingListItemAction(item.id, next);
      } catch {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)),
        );
        toast.error("Couldn't update that item.");
      }
    });
  };

  const remove = (id: string) => {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    startTransition(async () => {
      try {
        await deleteShoppingListItemAction(id);
      } catch {
        setItems(prev);
        toast.error("Couldn't remove that item.");
      }
    });
  };

  const handleAddManual = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const quantityRaw = formData.get("quantity");

    startTransition(async () => {
      try {
        const created = await addManualItemAction({
          name,
          quantity: quantityRaw ? Number(quantityRaw) : null,
          unit: String(formData.get("unit") ?? "") || null,
        });
        setItems((prev) => [...prev, created]);
      } catch {
        toast.error("Couldn't add that item.");
      }
    });
  };

  const clearChecked = () => {
    const prev = items;
    setItems((cur) => cur.filter((i) => !i.checked));
    startTransition(async () => {
      try {
        await clearCheckedItemsAction();
      } catch {
        setItems(prev);
        toast.error("Couldn't clear checked items.");
      }
    });
  };

  const uncheckedCount = items.filter((i) => !i.checked).length;
  const hasChecked = items.some((i) => i.checked);

  return (
    <div>
      <form
        action={handleAddManual}
        className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <input
          name="name"
          placeholder="Item name"
          required
          className="min-w-[140px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="quantity"
          type="number"
          step="any"
          placeholder="Qty"
          className="w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="unit"
          placeholder="Unit"
          className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" disabled={isPending}>
          Add
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {uncheckedCount} item{uncheckedCount === 1 ? "" : "s"} left
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChecked}
          disabled={isPending || !hasChecked}
        >
          Clear checked
        </Button>
      </div>

      <ul className="mt-3 space-y-1">
        {items.length === 0 ? (
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            Your list is empty — add items above, or use &quot;Add Ingredients
            to List&quot; from any recipe.
          </p>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggle(item)}
                  className="size-4"
                />
                <span
                  className={
                    item.checked
                      ? "text-zinc-400 line-through"
                      : "text-zinc-900 dark:text-zinc-50"
                  }
                >
                  {item.name}
                  {item.quantity
                    ? ` — ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                    : ""}
                </span>
                {item.source && (
                  <span className="text-xs text-zinc-400">({item.source})</span>
                )}
              </label>
              <button onClick={() => remove(item.id)} aria-label="Remove item">
                <Trash2 className="size-4 text-zinc-400 hover:text-red-500" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
