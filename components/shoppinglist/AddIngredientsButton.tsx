"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFromRecipeAction } from "@/app/actions/shoppinglist";

export function AddIngredientsButton({
  recipe,
}: {
  recipe: { id: number; title: string };
}) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await generateFromRecipeAction(recipe);

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          toast("Log in to build a shopping list", {
            action: {
              label: "Log in",
              onClick: () => (window.location.href = "/auth/login"),
            },
          });
        } else {
          toast.error("Couldn't add ingredients. Try again.");
        }
        return;
      }

      toast(`Added ${result.itemCount} ingredients to your shopping list`);
    });
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <ShoppingCart className="size-4" />
      {isPending ? "Adding..." : "Add Ingredients to List"}
    </Button>
  );
}
