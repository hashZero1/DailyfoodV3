

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  source text not null check (source in ('usda', 'ifct')),
  source_id text not null, -- USDA fdcId or IFCT food code, as a string
  region text, -- IFCT region tag (e.g. 'South', 'North East'); null for USDA / national-only
  is_cooked boolean not null default false, -- true for a pre-composed cooked-dish entry
  per_100g jsonb not null, -- CanonicalNutrients shape
  created_at timestamptz not null default now(),
  unique (source, source_id, region)
);

create index if not exists ingredients_name_search_idx
  on ingredients using gin (to_tsvector('english', canonical_name));
create index if not exists ingredients_source_idx on ingredients (source);

-- Same access-control model as the rest of the app: RLS enabled with no
-- policies, so only the service-role key (server-side only) can touch this
-- table.
alter table ingredients enable row level security;