"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFromMealPlanAction } from "@/app/actions/shoppinglist";

export function GenerateShoppingListButton({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const result = await generateFromMealPlanAction(startDate, endDate);
        if (result.itemCount === 0) {
          toast("Nothing planned this week to generate from.");
          return;
        }
        toast(
          `Added ingredients from ${result.recipeCount} recipe${
            result.recipeCount === 1 ? "" : "s"
          } to your shopping list`,
          {
            action: {
              label: "View list",
              onClick: () => (window.location.href = "/shopping-list"),
            },
          },
        );
      } catch {
        toast.error("Couldn't generate a shopping list. Try again.");
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <ShoppingCart className="size-4" />
      {isPending ? "Generating..." : "Generate Shopping List"}
    </Button>
  );
}
