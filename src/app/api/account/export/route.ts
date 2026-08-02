import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT_BYTES = 10 * 1024 * 1024;

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

async function requiredRows<T>(query: PromiseLike<QueryResult<T>>, label: string): Promise<T[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}_query_failed`);
  return result.data ?? [];
}

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

export async function GET(): Promise<Response> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return noStoreJson({ error: "SERVICE_UNAVAILABLE" }, 503);
  }
  const [userResult, claimsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims()
  ]);
  if (userResult.error || !userResult.data.user) return noStoreJson({ error: "AUTHENTICATION_REQUIRED" }, 401);
  if (claimsResult.error || claimsResult.data?.claims.aal !== "aal2") return noStoreJson({ error: "AAL2_REQUIRED" }, 403);

  const user = userResult.data.user;
  try {
    const [profiles, memberships, foodRiskProfiles, foodLogEntries] = await Promise.all([
      requiredRows(supabase.from("profiles").select("user_id, display_name, locale, timezone, week_starts_on, calorie_target, protein_target_g, calorie_carryover_percent, created_at, updated_at").eq("user_id", user.id), "profiles"),
      requiredRows(supabase.from("household_members").select("household_id, role, joined_at").eq("user_id", user.id), "memberships"),
      requiredRows(supabase.from("user_food_risk_profiles").select("id, canonical_key, kind, severity, confirmed_at, created_at").eq("user_id", user.id), "food_risk_profiles"),
      requiredRows(supabase.from("food_log_entries").select("id, household_id, product_id, batch_id, amount, unit, nutrition_snapshot, eaten_at, client_mutation_id, created_at").eq("user_id", user.id), "food_log_entries")
    ]);
    const householdIds = memberships.map((membership) => String(membership.household_id));
    const [households, products, inventoryBatches, inventoryEvents, recipes, mealPlanSlots, shoppingLists] = householdIds.length ? await Promise.all([
      requiredRows(supabase.from("households").select("id, name, currency, created_at, updated_at").in("id", householdIds), "households"),
      requiredRows(supabase.from("products").select("id, household_id, gtin, name, brand, generic_name, package_amount, package_unit, image_url, ingredients_text, source, source_updated_at, data_confidence, user_verified_at, created_at, updated_at").in("household_id", householdIds), "products"),
      requiredRows(supabase.from("inventory_batches").select("id, household_id, product_id, location, initial_amount, remaining_amount, unit, best_before_date, use_by_date, production_date, frozen_date, opened_at, after_opening_deadline, lot_number, serial_number, purchase_price_cents, purchased_at, date_source, date_confidence, created_at, updated_at").in("household_id", householdIds), "inventory_batches"),
      requiredRows(supabase.from("inventory_events").select("id, household_id, batch_id, event_type, amount_delta, client_mutation_id, note, occurred_at").eq("user_id", user.id).in("household_id", householdIds), "inventory_events"),
      requiredRows(supabase.from("recipes").select("id, household_id, name, servings, instructions, is_favorite, created_at, updated_at").in("household_id", householdIds), "recipes"),
      requiredRows(supabase.from("meal_plan_slots").select("id, household_id, user_id, planned_for, meal_type, recipe_id, product_id, servings, status, sort_order, created_at").eq("user_id", user.id).in("household_id", householdIds), "meal_plan_slots"),
      requiredRows(supabase.from("shopping_lists").select("id, household_id, week_start, status, predicted_total_cents, created_at, updated_at").in("household_id", householdIds), "shopping_lists")
    ]) : [[], [], [], [], [], [], []];

    const productIds = products.map((product) => String(product.id));
    const recipeIds = recipes.map((recipe) => String(recipe.id));
    const shoppingListIds = shoppingLists.map((list) => String(list.id));
    const [productNutrition, productMetadata, productIngredients, ingredientAssessments, recipeItems, shoppingItems] = await Promise.all([
      productIds.length ? requiredRows(supabase.from("product_nutrition").select("product_id, basis_amount, basis_unit, energy_kcal, protein_g, carbohydrates_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, micronutrients, source, confidence, updated_at").in("product_id", productIds), "product_nutrition") : [],
      productIds.length ? requiredRows(supabase.from("product_metadata").select("id, product_id, field_key, value_json, source, source_updated_at, confidence, user_verified_at").in("product_id", productIds), "product_metadata") : [],
      productIds.length ? requiredRows(supabase.from("product_ingredients").select("id, product_id, position, raw_name, normalized_name, e_number, percentage, is_allergen, is_trace, confidence").in("product_id", productIds), "product_ingredients") : [],
      productIds.length ? requiredRows(supabase.from("ingredient_assessments").select("id, product_id, ingredient_key, level, reason, evidence_url, exposure, confidence, ruleset_version, assessed_at").eq("user_id", user.id).in("product_id", productIds), "ingredient_assessments") : [],
      recipeIds.length ? requiredRows(supabase.from("recipe_items").select("id, recipe_id, product_id, amount, unit").in("recipe_id", recipeIds), "recipe_items") : [],
      shoppingListIds.length ? requiredRows(supabase.from("shopping_items").select("id, shopping_list_id, product_id, label, required_amount, unit, package_count, predicted_price_cents, checked_at, source, source_product_id, created_at").in("shopping_list_id", shoppingListIds), "shopping_items") : []
    ]);

    const exportedAt = new Date().toISOString();
    const payload = JSON.stringify({
      exportVersion: 1,
      exportedAt,
      identity: { id: user.id, email: user.email ?? null, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null },
      data: {
        profiles, memberships, households, foodRiskProfiles, products, productNutrition,
        productMetadata, productIngredients, ingredientAssessments, inventoryBatches,
        inventoryEvents, foodLogEntries, recipes, recipeItems, mealPlanSlots,
        shoppingLists, shoppingItems
      }
    });
    if (Buffer.byteLength(payload, "utf8") > MAX_EXPORT_BYTES) {
      return noStoreJson({ error: "EXPORT_TOO_LARGE", message: "Der direkte Export überschreitet 10 MB. Bitte fordere einen sicheren Support-Export an." }, 413);
    }
    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="foodos-export-${exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return noStoreJson({ error: "EXPORT_FAILED" }, 500);
  }
}
