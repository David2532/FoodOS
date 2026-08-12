begin;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Every FoodOS
-- RPC below either accesses private household data or is used by an RLS policy;
-- keep anonymous callers out and grant only the narrow authenticated surface.
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.has_aal2() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

grant execute on function public.onboard_household(text, text, integer, numeric) to authenticated;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.consume_inventory_batch(uuid, numeric, uuid) to authenticated;
grant execute on function public.consume_inventory_batch_v2(uuid, numeric, uuid, boolean, boolean) to authenticated;
grant execute on function public.plan_product(uuid, uuid, date, text, numeric, uuid) to authenticated;
grant execute on function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid) to authenticated;
grant execute on function public.generate_shopping_from_plan(uuid, date) to authenticated;
grant execute on function public.set_shopping_item_checked(uuid, boolean) to authenticated;
grant execute on function public.record_privacy_choices(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, uuid) to authenticated;
grant execute on function public.search_cached_products(text, integer) to authenticated;
grant execute on function public.search_global_catalog_products(text, integer) to authenticated;
grant execute on function public.lookup_global_catalog_product(text) to authenticated;

commit;
