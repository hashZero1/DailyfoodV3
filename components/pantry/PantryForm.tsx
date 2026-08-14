"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PANTRY_CATEGORIES } from "@/lib/constant";
import { addPantryItemAction } from "@/app/actions/pantry";
import type { PantryItemRecord } from "@/types/pantry";

export function PantryForm({
  onAdded,
}: {
  onAdded: (item: PantryItemRecord) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    const quantityRaw = formData.get("quantity");
    const thresholdRaw = formData.get("lowStockThreshold");
    const expiresAtRaw = String(formData.get("expiresAt") ?? "");

    startTransition(async () => {
      try {
        const created = await addPantryItemAction({
          name,
          quantity: quantityRaw ? Number(quantityRaw) : null,
          unit: String(formData.get("unit") ?? "") || null,
          category: String(formData.get("category") ?? "") || null,
          expiresAt: expiresAtRaw || null,
          lowStockThreshold: thresholdRaw ? Number(thresholdRaw) : null,
        });
        onAdded(created);
        formRef.current?.reset();
        toast(`Added ${created.name} to your pantry`);
      } catch {
        toast.error("Couldn't add that item. Try again.");
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-4 lg:grid-cols-6"
    >
      <input
        name="name"
        placeholder="Ingredient name"
        required
        className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        name="quantity"
        type="number"
        step="any"
        min={0}
        placeholder="Qty"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        name="unit"
        placeholder="Unit (g, cups...)"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        name="category"
        defaultValue=""
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Category</option>
        {PANTRY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        name="expiresAt"
        type="date"
        title="Expiration date (optional)"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        name="lowStockThreshold"
        type="number"
        step="any"
        min={0}
        placeholder="Low-stock at"
        title="Show a low-stock warning at or below this quantity"
        className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-1 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <Button
        type="submit"
        disabled={isPending}
        className="col-span-2 sm:col-span-1"
      >
        {isPending ? "Adding..." : "Add item"}
      </Button>
    </form>
  );
}
