-- FoodOS stores household, nutrition, inventory and potentially health-related profile
-- data. The existing membership policies stay in place; this restrictive policy adds
-- a mandatory verified TOTP/AAL2 condition to every private table operation.

create or replace function public.has_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.has_aal2() from public;
grant execute on function public.has_aal2() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'households',
    'household_members',
    'products',
    'product_nutrition',
    'product_metadata',
    'product_ingredients',
    'user_food_risk_profiles',
    'ingredient_assessments',
    'inventory_batches',
    'inventory_events',
    'food_log_entries',
    'recipes',
    'recipe_items',
    'meal_plan_slots',
    'shopping_lists',
    'shopping_items'
  ]
  loop
    execute format(
      'create policy require_aal2 on public.%I as restrictive for all to authenticated using (public.has_aal2()) with check (public.has_aal2())',
      table_name
    );
  end loop;
end
$$;
