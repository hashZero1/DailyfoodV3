import { auth0 } from "@/lib/auth0";
import { listPantryItems } from "@/lib/pantry";
import { PantryList } from "@/components/pantry/PantryList";
import { Button } from "@/components/ui/button";

export default async function PantryPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Log in to manage your pantry
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Your pantry is tied to your account.
        </p>
        <Button asChild className="mt-6">
          <a href="/auth/login?returnTo=/pantry">Log in</a>
        </Button>
      </main>
    );
  }

  const items = await listPantryItems(session.user.sub);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Your pantry
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Track what you have on hand.
      </p>

      <div className="mt-6">
        <PantryList initialItems={items} />
      </div>
    </main>
  );
}
