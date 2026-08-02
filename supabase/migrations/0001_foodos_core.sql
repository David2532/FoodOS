begin;

create extension if not exists pgcrypto;

create type public.household_role as enum ('owner', 'member');
create type public.storage_location as enum ('fridge', 'freezer', 'pantry', 'drinks', 'other');
create type public.date_kind as enum ('best_before', 'use_by', 'production', 'frozen', 'opened', 'after_opening');
create type public.risk_level as enum ('avoid', 'watch', 'info', 'ok', 'unknown');
create type public.inventory_event_type as enum ('purchase', 'consume', 'adjust', 'discard', 'transfer');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'de-DE',
  timezone text not null default 'Europe/Berlin',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  calorie_target integer check (calorie_target between 800 and 10000),
  protein_target_g numeric(7,2) check (protein_target_g between 0 and 1000),
  calorie_carryover_percent numeric(5,2) not null default 10 check (calorie_carryover_percent between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  currency char(3) not null default 'EUR',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  gtin text check (gtin ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(name) between 1 and 240),
  brand text,
  generic_name text,
  package_amount numeric(12,3) check (package_amount > 0),
  package_unit text check (package_unit in ('g', 'ml', 'piece')),
  image_url text,
  ingredients_text text,
  source text not null default 'manual',
  source_updated_at timestamptz,
  data_confidence numeric(4,3) not null default 0.5 check (data_confidence between 0 and 1),
  user_verified_at timestamptz,
  raw_source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, gtin)
);

create index products_household_name_idx on public.products (household_id, lower(name));

create table public.product_nutrition (
  product_id uuid primary key references public.products(id) on delete cascade,
  basis_amount numeric(8,3) not null default 100,
  basis_unit text not null check (basis_unit in ('g', 'ml')),
  energy_kcal numeric(9,3),
  protein_g numeric(9,3),
  carbohydrates_g numeric(9,3),
  sugars_g numeric(9,3),
  fat_g numeric(9,3),
  saturated_fat_g numeric(9,3),
  fiber_g numeric(9,3),
  salt_g numeric(9,4),
  micronutrients jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  updated_at timestamptz not null default now()
);

create table public.product_metadata (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  field_key text not null,
  value_json jsonb not null,
  source text not null,
  source_updated_at timestamptz,
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  user_verified_at timestamptz,
  unique (product_id, field_key, source)
);

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null check (position >= 0),
  raw_name text not null,
  normalized_name text,
  e_number text,
  percentage numeric(6,3) check (percentage between 0 and 100),
  is_allergen boolean not null default false,
  is_trace boolean not null default false,
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  unique (product_id, position, is_trace)
);

create table public.user_food_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_key text not null,
  kind text not null check (kind in ('allergen', 'intolerance', 'exclusion', 'medical')),
  severity text not null default 'notice' check (severity in ('notice', 'avoid', 'strict_avoid')),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, canonical_key, kind)
);

create table public.ingredient_assessments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  ingredient_key text not null,
  level public.risk_level not null,
  reason text not null,
  evidence_url text,
  exposure jsonb,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  ruleset_version text not null,
  assessed_at timestamptz not null default now()
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  location public.storage_location not null default 'pantry',
  initial_amount numeric(12,3) not null check (initial_amount > 0),
  remaining_amount numeric(12,3) not null check (remaining_amount >= 0),
  unit text not null check (unit in ('g', 'ml', 'piece')),
  best_before_date date,
  use_by_date date,
  production_date date,
  frozen_date date,
  opened_at timestamptz,
  after_opening_deadline timestamptz,
  lot_number text,
  serial_number text,
  purchase_price_cents integer check (purchase_price_cents >= 0),
  purchased_at timestamptz not null default now(),
  date_source text,
  date_confidence numeric(4,3) check (date_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_amount <= initial_amount),
  check (best_before_date is null or use_by_date is null)
);

create index inventory_household_expiry_idx on public.inventory_batches (household_id, best_before_date, use_by_date) where remaining_amount > 0;

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type public.inventory_event_type not null,
  amount_delta numeric(12,3) not null check (amount_delta <> 0),
  client_mutation_id uuid not null,
  note text,
  occurred_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  amount numeric(12,3) not null check (amount > 0),
  unit text not null check (unit in ('g', 'ml', 'piece', 'serving')),
  nutrition_snapshot jsonb not null,
  eaten_at timestamptz not null default now(),
  client_mutation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  servings numeric(7,2) not null default 1 check (servings > 0),
  instructions text,
  is_favorite boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  amount numeric(12,3) not null check (amount > 0),
  unit text not null check (unit in ('g', 'ml', 'piece'))
);

create table public.meal_plan_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  planned_for date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  servings numeric(7,2) not null default 1 check (servings > 0),
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  check ((recipe_id is not null)::integer + (product_id is not null)::integer = 1)
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  status text not null default 'open' check (status in ('open', 'shopping', 'completed', 'archived')),
  predicted_total_cents integer check (predicted_total_cents >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  label text not null,
  required_amount numeric(12,3),
  unit text,
  package_count integer check (package_count > 0),
  predicted_price_cents integer check (predicted_price_cents >= 0),
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger households_updated before update on public.households for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger inventory_batches_updated before update on public.inventory_batches for each row execute function public.set_updated_at();
create trigger recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
create trigger shopping_lists_updated before update on public.shopping_lists for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.products enable row level security;
alter table public.product_nutrition enable row level security;
alter table public.product_metadata enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.user_food_risk_profiles enable row level security;
alter table public.ingredient_assessments enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_events enable row level security;
alter table public.food_log_entries enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.meal_plan_slots enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

create policy profiles_own on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy households_members on public.households for select using (public.is_household_member(id));
create policy households_insert on public.households for insert with check (created_by = auth.uid());
create policy households_owner_update on public.households for update using (public.is_household_owner(id));
create policy members_read on public.household_members for select using (public.is_household_member(household_id));
create policy members_owner_write on public.household_members for all using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

create policy products_household on public.products for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy nutrition_household on public.product_nutrition for all using (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)));
create policy metadata_household on public.product_metadata for all using (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)));
create policy ingredients_household on public.product_ingredients for all using (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)));
create policy food_risks_own on public.user_food_risk_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assessments_visible on public.ingredient_assessments for select using (user_id is null or user_id = auth.uid() or exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)));
create policy assessments_write on public.ingredient_assessments for insert with check ((user_id is null or user_id = auth.uid()) and exists (select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)));

create policy batches_household on public.inventory_batches for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy events_household on public.inventory_events for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy food_log_household on public.food_log_entries for select using (public.is_household_member(household_id));
create policy food_log_own_write on public.food_log_entries for insert with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy food_log_own_update on public.food_log_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recipes_household on public.recipes for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy recipe_items_household on public.recipe_items for all using (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_household_member(r.household_id))) with check (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_household_member(r.household_id)));
create policy meal_plan_household on public.meal_plan_slots for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_lists_household on public.shopping_lists for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_items_household on public.shopping_items for all using (exists (select 1 from public.shopping_lists sl where sl.id = shopping_list_id and public.is_household_member(sl.household_id))) with check (exists (select 1 from public.shopping_lists sl where sl.id = shopping_list_id and public.is_household_member(sl.household_id)));

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.households (name, created_by) values (household_name, auth.uid()) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role) values (new_household_id, auth.uid(), 'owner');
  return new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;

commit;
