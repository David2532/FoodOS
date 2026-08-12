begin;

-- Inventory quantities and their audit trail may only change through the
-- security-definer transaction RPCs. Household members retain read access.
drop policy if exists events_household on public.inventory_events;
create policy events_household_read on public.inventory_events
  for select to authenticated
  using (public.is_household_member(household_id));

revoke insert, update, delete on public.inventory_events from authenticated;
revoke insert, update, delete on public.inventory_batches from authenticated;

-- Consumption logs are personal nutrition data. Other household members do not
-- need row-level visibility, and clients may not fabricate or rewrite entries.
drop policy if exists food_log_household on public.food_log_entries;
drop policy if exists food_log_own_write on public.food_log_entries;
drop policy if exists food_log_own_update on public.food_log_entries;
create policy food_log_own_read on public.food_log_entries
  for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.food_log_entries from authenticated;

create index if not exists products_gtin_lookup_idx on public.products (gtin)
  where gtin is not null;
create index if not exists food_log_user_eaten_idx on public.food_log_entries (user_id, eaten_at desc);

commit;
