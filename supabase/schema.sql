-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- There's no migration tool here since we dropped Prisma — this file is the
-- source of truth for the schema; edit it and re-run statements as it evolves.
--
-- user_id is Auth0's `sub` claim (e.g. "auth0|abc123" or "google-oauth2|..."),
-- not a Supabase Auth uid — Auth0 owns identity, Supabase is just storage.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recipe_id integer not null,
  title text not null,
  image text,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  quantity numeric,
  unit text,
  created_at timestamptz not null default now()
);

-- Added for the Phase 2 pantry feature: categories, expiration tracking,
-- and a per-item low-stock threshold. Safe to re-run.
alter table pantry_items add column if not exists category text;
alter table pantry_items add column if not exists expires_at date;
alter table pantry_items add column if not exists low_stock_threshold numeric;

create table if not exists meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  meal_type text not null, -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe_id integer not null,
  title text not null,
  image text,
  created_at timestamptz not null default now()
);

-- Added for the meal planner's daily macro totals. Snapshotted at
-- add-time (from Spoonacular's nutrition data) rather than re-fetched
-- on every planner page load. Safe to re-run.
alter table meal_plan_entries add column if not exists calories numeric;
alter table meal_plan_entries add column if not exists protein_g numeric;
alter table meal_plan_entries add column if not exists carbs_g numeric;
alter table meal_plan_entries add column if not exists fat_g numeric;

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  quantity numeric,
  unit text,
  checked boolean not null default false,
  source text, -- recipe title this came from, or null if added manually
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_user_id_idx on shopping_list_items (user_id);
alter table shopping_list_items enable row level security;

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  quantity numeric,
  unit text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_user_id_idx on shopping_list_items (user_id);
alter table shopping_list_items enable row level security;

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  quantity numeric,
  unit text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_user_id_idx on shopping_list_items (user_id);
alter table shopping_list_items enable row level security;

-- Added for the meal planner's daily calorie/macro totals — a nutrition
-- snapshot taken when the meal is planned, so totals don't require
-- re-fetching every recipe's nutrition on every page load. Safe to re-run.
alter table meal_plan_entries add column if not exists calories numeric;
alter table meal_plan_entries add column if not exists protein numeric;
alter table meal_plan_entries add column if not exists carbs numeric;
alter table meal_plan_entries add column if not exists fat numeric;

create index if not exists favorites_user_id_idx on favorites (user_id);
create index if not exists pantry_items_user_id_idx on pantry_items (user_id);
create index if not exists meal_plan_entries_user_id_idx on meal_plan_entries (user_id);

-- Enable RLS with NO policies on every table. This blocks the anon/public
-- key from reading or writing anything. Only the service role key
-- (lib/supabase.ts, server-side only) can touch these tables — that's the
-- access-control model here instead of Supabase-Auth-based RLS policies.
alter table favorites enable row level security;
alter table pantry_items enable row level security;
alter table meal_plan_entries enable row level security;