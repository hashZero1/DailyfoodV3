"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseSearchQueryAction } from "@/app/actions/ai-search";
import type { ParsedSearchQuery } from "@/lib/gemini";

export function AiSearchBar() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedSearchQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await parseSearchQueryAction(input);
      if (!result.ok) {
        setError(result.message);
        setParsed(null);
        return;
      }
      setParsed(result.filters);
    });
  };

  const runSearch = () => {
    if (!parsed) return;
    const params = new URLSearchParams();
    if (parsed.query) params.set("query", parsed.query);
    if (parsed.cuisine) params.set("cuisine", parsed.cuisine);
    if (parsed.diet) params.set("diet", parsed.diet);
    if (parsed.type) params.set("type", parsed.type);
    if (parsed.maxReadyTime)
      params.set("maxReadyTime", String(parsed.maxReadyTime));
    if (parsed.maxCalories)
      params.set("maxCalories", String(parsed.maxCalories));
    if (parsed.minProtein) params.set("minProtein", String(parsed.minProtein));
    router.push(`/search?${params.toString()}`);
  };

  const hasAnyFilter =
    parsed &&
    (parsed.query ||
      parsed.cuisine ||
      parsed.diet ||
      parsed.type ||
      parsed.maxReadyTime ||
      parsed.maxCalories ||
      parsed.minProtein);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try "high-protein vegetarian dinner under 500 calories and 30 minutes"'
          className="min-w-[240px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" disabled={isPending}>
          <Sparkles className="size-4" />
          {isPending ? "Thinking..." : "Ask AI"}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {parsed && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            I understood:
          </span>
          {parsed.query && <Badge variant="secondary">{parsed.query}</Badge>}
          {parsed.cuisine && (
            <Badge variant="secondary">{parsed.cuisine}</Badge>
          )}
          {parsed.diet && <Badge variant="secondary">{parsed.diet}</Badge>}
          {parsed.type && (
            <Badge variant="secondary" className="capitalize">
              {parsed.type}
            </Badge>
          )}
          {parsed.maxReadyTime && (
            <Badge variant="secondary">under {parsed.maxReadyTime} min</Badge>
          )}
          {parsed.maxCalories && (
            <Badge variant="secondary">under {parsed.maxCalories} cal</Badge>
          )}
          {parsed.minProtein && (
            <Badge variant="secondary">{parsed.minProtein}g+ protein</Badge>
          )}
          {!hasAnyFilter && (
            <Badge variant="secondary">no specific filters detected</Badge>
          )}
          <Button size="sm" onClick={runSearch}>
            Search
          </Button>
        </div>
      )}
    </div>
  );
}
