"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/app/actions/favorites";

export function FavoriteButton({
  recipe,
  initialFavorited,
}: {
  recipe: { id: number; title: string; image?: string };
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  const handleClick = () => {
    // Optimistic update — reverted if the action reports failure.
    const next = !favorited;
    setFavorited(next);

    startTransition(async () => {
      const result = await toggleFavoriteAction(recipe, favorited);

      if (!result.ok) {
        setFavorited(!next); // revert
        if (result.reason === "unauthenticated") {
          toast("Log in to save recipes", {
            action: {
              label: "Log in",
              onClick: () =>
                (window.location.href = `/auth/login?returnTo=${encodeURIComponent(pathname)}`),
            },
          });
        } else {
          toast.error("Couldn't update favorites. Try again.");
        }
        return;
      }

      toast(
        result.favorited
          ? "🥧 Recipe added to your favorites!"
          : "Removed from favorites",
      );
    });
  };

  return (
    <Button
      variant={favorited ? "default" : "outline"}
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <motion.span
        animate={favorited ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.3 }}
        className="inline-flex"
      >
        <Heart className={cn("size-4", favorited && "fill-current")} />
      </motion.span>
      {favorited ? "Favorited" : "Add to Favorites"}
    </Button>
  );
}
