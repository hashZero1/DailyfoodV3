import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { listPantryItems } from "@/lib/pantry";
import { FridgeMatcher } from "@/components/fridge/FridgeMatcher";
import { Button } from "@/components/ui/button";

export default async function FridgePage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Log in to use What&apos;s in My Fridge
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          This matches recipes against your saved pantry.
        </p>
        <Button className="mt-6">
          <a href="/auth/login?returnTo=/fridge">Log in</a>
        </Button>
      </main>
    );
  }

  const pantryItems = await listPantryItems(session.user.sub);

  if (pantryItems.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Your pantry is empty
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Add a few ingredients to your pantry first, then come back here to
          find recipes you can make.
        </p>
        <Button className="mt-6">
          <Link href="/pantry">Go to pantry</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        What&apos;s in my Fridge?
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Pick what you want to cook with — unchecked items are excluded.
      </p>

      <div className="mt-6">
        <FridgeMatcher pantryItems={pantryItems} />
      </div>
    </main>
  );
}
