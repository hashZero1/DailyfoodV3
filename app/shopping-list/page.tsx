import { auth0 } from "@/lib/auth0";
import { listShoppingListItems } from "@/lib/shoppinglist";
import { ShoppingListView } from "@/components/shoppinglist/ShoppingListView";
import { Button } from "@/components/ui/button";

export default async function ShoppingListPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Log in to see your shopping list
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Your list is tied to your account.
        </p>
        <Button className="mt-6">
          <a href="/auth/login?returnTo=/shopping-list">Log in</a>
        </Button>
      </main>
    );
  }

  const items = await listShoppingListItems(session.user.sub);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Shopping List
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Add items manually, or generate from a recipe or your meal plan.
      </p>

      <div className="mt-6">
        <ShoppingListView initialItems={items} />
      </div>
    </main>
  );
}
