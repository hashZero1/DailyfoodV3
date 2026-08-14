import Link from "next/link";
import { auth0 } from "@/lib/auth0";

export default async function Navbar() {
  const session = await auth0.getSession();

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold text-orange-600">
          🍳 Recipe Assistant
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/search"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            Search
          </Link>
          <Link
            href="/favorites"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            Favorites
          </Link>
          <Link
            href="/pantry"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            Pantry
          </Link>
          <Link
            href="/fridge"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            My Fridge
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 dark:text-zinc-400">
                {session.user.name ?? session.user.email}
              </span>
              <a
                href="/auth/logout"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                Sign out
              </a>
            </div>
          ) : (
            <a
              href="/auth/login"
              className="rounded-full bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
            >
              Sign in
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
