"use client";

import { useMemo, useState } from "react";
import { PantryForm } from "@/components/pantry/PantryForm";
import { PantryItemRow } from "@/components/pantry/PantryItemRow";
import type { PantryItemRecord } from "@/types/pantry";

export function PantryList({
  initialItems,
}: {
  initialItems: PantryItemRecord[];
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div>
      <PantryForm onAdded={(item) => setItems((prev) => [item, ...prev])} />

      <input
        type="text"
        placeholder="Search your pantry..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            {items.length === 0
              ? "Your pantry is empty — add your first item above."
              : "No items match your search."}
          </p>
        ) : (
          filtered.map((item) => (
            <PantryItemRow
              key={item.id}
              item={item}
              onRemoved={(id) =>
                setItems((prev) => prev.filter((i) => i.id !== id))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
