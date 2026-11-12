-- Nutrition stage2b names schema filename

-- Stage 2b: display names. Run AFTER nutrition-stage2-schema.sql. Safe to re-run.
-- Display order in the UI: common_name, then "also known as", then canonical_name
-- (the official source name). Re-seeding IFCT does not touch these columns.

alter table ingredients add column if not exists common_name text;
alter table ingredients add column if not exists also_known_as text[] not null default '{}';
-- 'ai' = suggested by scripts/enrich-common-names.ts, 'curated' = set by hand, 'user' = approved user suggestion.
alter table ingredients add column if not exists common_name_source text
  check (common_name_source is null or common_name_source in ('ai', 'curated', 'user'));
alter table ingredients add column if not exists common_name_reviewed boolean not null default false;

-- For the later UI: users propose the name they use for a food. Nothing here is
-- matched or shown until a row is approved and its name is merged into
-- ingredients.aliases / also_known_as by an admin step.
create table if not exists ingredient_name_suggestions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  suggested_name text not null check (length(trim(suggested_name)) between 1 and 60),
  user_id text not null, -- Auth0 sub
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (ingredient_id, user_id, suggested_name)
);
create index if not exists ingredient_name_suggestions_status_idx on ingredient_name_suggestions (status);

alter table ingredient_name_suggestions enable row level security;