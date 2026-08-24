import { Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWinePairing } from "@/lib/spoonacular";

export async function WinePairing({ dish }: { dish: string }) {
  const pairing = await getWinePairing(dish).catch(() => null);

  if (!pairing || pairing.pairedWines.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
        <Wine className="size-4" />
        Pairs well with
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {pairing.pairedWines.map((wine) => (
          <Badge key={wine} variant="secondary" className="capitalize">
            {wine}
          </Badge>
        ))}
      </div>
      {pairing.pairingText && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {pairing.pairingText}
        </p>
      )}
    </div>
  );
}
