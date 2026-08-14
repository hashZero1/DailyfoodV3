"use server";

import { auth0 } from "@/lib/auth0";
import { addFavorite, removeFavorite } from "@/lib/favorites";

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; reason: "unauthenticated" | "error"; message?: string };

export async function toggleFavoriteAction(
  recipe: { id: number; title: string; image?: string },
  currentlyFavorited: boolean,
): Promise<ToggleFavoriteResult> {
  const session = await auth0.getSession();

  if (!session?.user?.sub) {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    if (currentlyFavorited) {
      await removeFavorite(session.user.sub, recipe.id);
      return { ok: true, favorited: false };
    }
    await addFavorite(session.user.sub, recipe);
    return { ok: true, favorited: true };
  } catch (error) {
    console.error("toggleFavoriteAction failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}
