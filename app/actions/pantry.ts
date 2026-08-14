"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import {
  addPantryItem,
  updatePantryItemQuantity,
  deletePantryItem,
} from "@/lib/pantry";
import type { PantryItemInput } from "@/types/pantry";

async function requireUserId(): Promise<string> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    throw new Error("You must be logged in.");
  }
  return session.user.sub;
}

export async function addPantryItemAction(item: PantryItemInput) {
  const userId = await requireUserId();
  const created = await addPantryItem(userId, item);
  revalidatePath("/pantry");
  return created;
}

export async function updatePantryQuantityAction(
  itemId: string,
  quantity: number,
) {
  const userId = await requireUserId();
  await updatePantryItemQuantity(userId, itemId, quantity);
  revalidatePath("/pantry");
}

export async function deletePantryItemAction(itemId: string) {
  const userId = await requireUserId();
  await deletePantryItem(userId, itemId);
  revalidatePath("/pantry");
}
