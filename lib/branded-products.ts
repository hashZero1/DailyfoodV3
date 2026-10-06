import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getProductByBarcode, searchIndianProducts } from "@/lib/openfoodfacts";
import type { CanonicalBrandedProduct } from "@/types/branded-product";

// Uses the same service-role Supabase client pattern as the rest of the
// app (server-only, no RLS policies — see supabase/schema.sql).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function upsert(product: CanonicalBrandedProduct) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("branded_products")
    .upsert(
      { ...product, updated_at: new Date().toISOString() },
      { onConflict: "barcode" },
    );
  if (error) {
    console.error(
      `Failed to cache branded product ${product.barcode}:`,
      error.message,
    );
  }
}

/**
 * Barcode lookup with a local-first cache: checks branded_products before
 * hitting Open Food Facts, and caches on a miss. This is Phase 2's
 * equivalent of a seed script — the table grows from real lookups instead
 * of a bulk import.
 */
export async function lookupBrandedProductByBarcode(
  barcode: string,
): Promise<CanonicalBrandedProduct | null> {
  const supabase = getSupabase();

  const { data: cached } = await supabase
    .from("branded_products")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();

  if (cached) return cached as CanonicalBrandedProduct;

  const fetched = await getProductByBarcode(barcode);
  if (fetched) await upsert(fetched);
  return fetched;
}

/**
 * Search-and-cache: queries Open Food Facts India directly (search results
 * aren't worth a cache-read first, since the query itself varies), then
 * caches every result by barcode so a later direct lookup is local.
 */
export async function searchAndCacheBrandedProducts(
  query: string,
): Promise<CanonicalBrandedProduct[]> {
  const results = await searchIndianProducts(query);
  await Promise.all(results.map(upsert));
  return results;
}
