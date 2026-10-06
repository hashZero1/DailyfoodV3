-- Phase 2 of the regional nutrition data subsystem (nutrition-data-roadmap.md).
-- Run in the Supabase SQL editor, same as schema.sql.
--
-- No bulk seed for this table, by design — unlike ingredients (Phase 1,
-- ~542 + a curated USDA set, genuinely seedable up front), Open Food Facts
-- has 3M+ products. This table is populated lazily: a barcode lookup or
-- search in lib/openfoodfacts.ts upserts whatever it fetches, so the table
-- grows to cover exactly what your users actually scan or search for.

create table if not exists branded_products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand text,
  barcode text not null,
  source text not null default 'openfoodfacts' check (source in ('openfoodfacts', 'firecrawl')),
  countries text[] not null default '{}',
  per_100g jsonb not null, -- CanonicalNutrients shape, same as ingredients.per_100g
  serving_size_g numeric,
  nutrition_data_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barcode)
);

create index if not exists branded_products_name_search_idx
  on branded_products using gin (to_tsvector('english', canonical_name));
create index if not exists branded_products_barcode_idx on branded_products (barcode);

alter table branded_products enable row level security;