-- Forward-only migration: nutrition_summary_contract
-- Review RLS, grants, function execution privileges and rollback/recovery impact.
-- Add or update the relevant pgTAP coverage before applying this migration.

begin;

-- Product nutrition is written only by the validated inventory transaction RPC.
-- Browser sessions keep read access for household inventory display, but cannot
-- rewrite the source values used for future consumption snapshots.
revoke insert, update, delete on table public.product_nutrition from authenticated;

-- A personal nutrition log remains private and additionally requires an active
-- membership in the household that owns the source batch. This closes access for
-- removed members without broadening visibility to other household members.
drop policy if exists food_log_own_read on public.food_log_entries;
create policy food_log_own_read on public.food_log_entries
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and public.is_household_member(household_id)
  );

create or replace function public.get_my_nutrition_summary(target_week_start date)
returns table (
  summary_date date,
  entry_count bigint,
  kcal numeric,
  kcal_known_count bigint,
  protein_g numeric,
  protein_known_count bigint,
  carbohydrates_g numeric,
  carbohydrates_known_count bigint,
  fat_g numeric,
  fat_known_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_timezone text;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if target_week_start is null
    or extract(isodow from target_week_start) <> 1
    or target_week_start not between date '2000-01-03' and date '2100-12-27' then
    raise exception using errcode = '22023', message = 'Invalid week start';
  end if;

  select profile.timezone
  into actor_timezone
  from public.profiles profile
  where profile.user_id = actor_id;

  if actor_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone_name
      where timezone_name.name = actor_timezone
    ) then
    raise exception using errcode = '22023', message = 'Unsupported profile timezone';
  end if;

  return query
  with day_buckets as (
    select (target_week_start + day_offset)::date as local_date
    from pg_catalog.generate_series(0, 6) as day_offset
  ), authorized_logs as (
    select
      (entry.eaten_at at time zone actor_timezone)::date as local_date,
      entry.nutrition_snapshot
    from public.food_log_entries entry
    where entry.user_id = actor_id
      and entry.household_id in (
        select membership.household_id
        from public.household_members membership
        where membership.user_id = actor_id
      )
      and entry.eaten_at >= (target_week_start::timestamp at time zone actor_timezone)
      and entry.eaten_at < ((target_week_start + 7)::timestamp at time zone actor_timezone)
  )
  select
    day.local_date,
    count(log_entry.nutrition_snapshot)::bigint,
    sum((log_entry.nutrition_snapshot ->> 'kcal')::numeric)
      filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'kcal') = 'number'
        and (log_entry.nutrition_snapshot ->> 'kcal')::numeric between 0 and 100000),
    count(*) filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'kcal') = 'number'
      and (log_entry.nutrition_snapshot ->> 'kcal')::numeric between 0 and 100000)::bigint,
    sum((log_entry.nutrition_snapshot ->> 'protein_g')::numeric)
      filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'protein_g') = 'number'
        and (log_entry.nutrition_snapshot ->> 'protein_g')::numeric between 0 and 10000),
    count(*) filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'protein_g') = 'number'
      and (log_entry.nutrition_snapshot ->> 'protein_g')::numeric between 0 and 10000)::bigint,
    sum((log_entry.nutrition_snapshot ->> 'carbohydrates_g')::numeric)
      filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'carbohydrates_g') = 'number'
        and (log_entry.nutrition_snapshot ->> 'carbohydrates_g')::numeric between 0 and 10000),
    count(*) filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'carbohydrates_g') = 'number'
      and (log_entry.nutrition_snapshot ->> 'carbohydrates_g')::numeric between 0 and 10000)::bigint,
    sum((log_entry.nutrition_snapshot ->> 'fat_g')::numeric)
      filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'fat_g') = 'number'
        and (log_entry.nutrition_snapshot ->> 'fat_g')::numeric between 0 and 10000),
    count(*) filter (where pg_catalog.jsonb_typeof(log_entry.nutrition_snapshot -> 'fat_g') = 'number'
      and (log_entry.nutrition_snapshot ->> 'fat_g')::numeric between 0 and 10000)::bigint
  from day_buckets day
  left join authorized_logs log_entry on log_entry.local_date = day.local_date
  group by day.local_date
  order by day.local_date;
end;
$$;

revoke all on function public.get_my_nutrition_summary(date)
  from public, anon, authenticated;
grant execute on function public.get_my_nutrition_summary(date) to authenticated;

commit;
