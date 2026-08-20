import { CookWithWhatIHave } from "@/components/cookwith/CookWithWhatIHave";

export default function CookWithWhatIHavePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Cook With What I Have
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Describe what&apos;s in your kitchen in plain language — no account or
        saved pantry needed.
      </p>

      <div className="mt-6">
        <CookWithWhatIHave />
      </div>
    </main>
  );
}
