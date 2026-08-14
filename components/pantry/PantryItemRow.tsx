"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updatePantryQuantityAction,
  deletePantryItemAction,
} from "@/app/actions/pantry";
import type { PantryItemRecord } from "@/types/pantry";

function daysUntil(dateStr: string): number {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function PantryItemRow({
  item,
  onRemoved,
}: {
  item: PantryItemRecord;
  onRemoved: (id: string) => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity ?? 0);
  const [isPending, startTransition] = useTransition();

  const isLowStock =
    item.low_stock_threshold !== null && quantity <= item.low_stock_threshold;
  const expiryDays = item.expires_at ? daysUntil(item.expires_at) : null;
  const isExpiringSoon = expiryDays !== null && expiryDays <= 3;

  const adjustQuantity = (delta: number) => {
    const next = Math.max(0, quantity + delta);
    setQuantity(next); // optimistic
    startTransition(async () => {
      try {
        await updatePantryQuantityAction(item.id, next);
      } catch {
        setQuantity(quantity); // revert
        toast.error("Couldn't update quantity.");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deletePantryItemAction(item.id);
        onRemoved(item.id);
      } catch {
        toast.error("Couldn't remove that item.");
      }
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {item.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {item.category && <Badge variant="secondary">{item.category}</Badge>}
          {isLowStock && <Badge variant="destructive">Low stock</Badge>}
          {isExpiringSoon && (
            <Badge variant="destructive">
              {expiryDays! <= 0 ? "Expired" : `Expires in ${expiryDays}d`}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={isPending}
          onClick={() => adjustQuantity(-1)}
          aria-label="Decrease quantity"
        >
          <Minus className="size-4" />
        </Button>
        <span className="w-16 text-center text-sm tabular-nums">
          {quantity} {item.unit ?? ""}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={isPending}
          onClick={() => adjustQuantity(1)}
          aria-label="Increase quantity"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Remove item"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
