begin;

-- Supabase's current API default no longer auto-exposes new public tables. Keep
-- that safer default and grant only authenticated sessions access; row-level
-- security and the restrictive AAL2 policy still decide which rows are visible.

revoke all on table
  public.profiles,
  public.households,
  public.household_members,
  public.products,
  public.product_nutrition,
  public.product_metadata,
  public.product_ingredients,
  public.user_food_risk_profiles,
  public.ingredient_assessments,
  public.inventory_batches,
  public.inventory_events,
  public.food_log_entries,
  public.recipes,
  public.recipe_items,
  public.meal_plan_slots,
  public.shopping_lists,
  public.shopping_items
from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.households,
  public.household_members,
  public.products,
  public.product_nutrition,
  public.product_metadata,
  public.product_ingredients,
  public.user_food_risk_profiles,
  public.ingredient_assessments,
  public.inventory_batches,
  public.inventory_events,
  public.food_log_entries,
  public.recipes,
  public.recipe_items,
  public.meal_plan_slots,
  public.shopping_lists,
  public.shopping_items
to authenticated;

commit;
