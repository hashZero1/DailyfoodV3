-- Phase 3 of the regional nutrition data subsystem: unit conversions.
-- Run AFTER nutrition-phase1-schema.sql, in the Supabase SQL editor. Safe to re-run.
--
-- Two kinds of reference data:
--   unit_definitions  what a unit IS (katori = 225 ml; roti is a count unit)
--   unit_conversions  what a unit WEIGHS for a given food (grams per katori of
--                     cooked rice), or a density (g/ml) that turns any volume
--                     unit into grams for a given food.
--
-- Rule enforced by the CHECKs below: every row carries a non-empty `source`
-- and a `basis`, so the engine can report how trustworthy a conversion is.
--   published    taken from a cited published table
--   user-defined a value the project owner chose (e.g. katori size)
--   derived      computed from a cited source (e.g. density from a USDA measure)
--   assumed      standard-kitchen assumption not yet checked against an Indian source

-- IFCT group name, e.g. 'Cereals and Millets'. Filled by lib/ifct.ts on the next IFCT seed run.
alter table ingredients add column if not exists food_group text;
create index if not exists ingredients_food_group_idx on ingredients (food_group);

create table if not exists unit_definitions (
  unit text primary key, -- normalized: 'katori', 'tbsp', 'roti' ...
  kind text not null check (kind in ('volume', 'count')),
  ml numeric check (ml is null or ml > 0),
  basis text not null check (basis in ('published', 'user-defined', 'derived', 'assumed')),
  source text not null check (length(trim(source)) > 0),
  note text,
  created_at timestamptz not null default now(),
  check ((kind = 'volume' and ml is not null) or (kind = 'count' and ml is null))
);

create table if not exists unit_conversions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references ingredients(id) on delete cascade, -- most specific scope
  food_group text, -- next scope: matches ingredients.food_group
  -- State of the food AS MEASURED. 'cooked' means grams of cooked food, not of
  -- the raw commodity; converting back to raw is Phase 5's yield-factor job.
  state text not null default 'any' check (state in ('raw', 'cooked', 'any')),
  unit text references unit_definitions(unit),
  grams_per_unit numeric check (grams_per_unit > 0), -- direct: grams in ONE unit
  density_g_per_ml numeric check (density_g_per_ml > 0), -- or: applies to every volume unit
  basis text not null check (basis in ('published', 'user-defined', 'derived', 'assumed')),
  source text not null check (length(trim(source)) > 0),
  note text,
  created_at timestamptz not null default now(),
  check (ingredient_id is not null or food_group is not null),
  check (
    (unit is not null and grams_per_unit is not null and density_g_per_ml is null)
    or (unit is null and density_g_per_ml is not null and grams_per_unit is null)
  )
);

create index if not exists unit_conversions_ingredient_idx on unit_conversions (ingredient_id);
create index if not exists unit_conversions_group_idx on unit_conversions (food_group);

-- Same access model as every other table: RLS on, no policies, service-role only.
alter table unit_definitions enable row level security;
alter table unit_conversions enable row level security;