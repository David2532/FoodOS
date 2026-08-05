import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nutritionSummaryRowsSchema } from "@/contracts/nutrition-summary";
import { classifyExpiry } from "@/domain/expiry";
import { criticalFoodRiskMatches, type FoodRiskPreference } from "@/domain/ingredient-relevance";
import { buildNutritionSummary } from "@/domain/nutrition-summary";
import { assessRecall, type RecallAssessment, type RecallNotice } from "@/domain/recall";
import type { AppSnapshot, InventoryItem } from "@/lib/types";

const membershipSchema = z.object({
  household_id: z.uuid(),
  households: z.object({ id: z.uuid(), name: z.string() })
});

const inventoryRowSchema = z.object({
  id: z.uuid(),
  product_id: z.uuid(),
  remaining_amount: z.coerce.number(),
  unit: z.enum(["g", "ml", "piece"]),
  location: z.enum(["fridge", "freezer", "pantry", "drinks", "other"]),
  best_before_date: z.string().nullable(),
  use_by_date: z.string().nullable(),
  lot_number: z.string().nullable(),
  products: z.object({ gtin: z.string().nullable(), name: z.string(), brand: z.string().nullable(), image_url: z.string().nullable() })
});

const nutritionRowSchema = z.object({
  product_id: z.uuid(),
  energy_kcal: z.coerce.number().nullable(),
  protein_g: z.coerce.number().nullable(),
  carbohydrates_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable()
});

const profileSchema = z.object({
  calorie_target: z.coerce.number().nullable(),
  protein_target_g: z.coerce.number().nullable()
});

const mealPlanRowSchema = z.object({
  id: z.uuid(),
  product_id: z.uuid(),
  planned_for: z.string(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  servings: z.coerce.number(),
  planned_amount: z.coerce.number().positive(),
  planned_unit: z.enum(["g", "ml", "piece"]),
  revision: z.coerce.number().int().positive(),
  products: z.object({ name: z.string() })
});

const shoppingListSchema = z.object({
  id: z.uuid(),
  calculation_revision: z.coerce.number().int().nonnegative()
});
const shoppingItemSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  required_amount: z.coerce.number().nullable(),
  unit: z.string().nullable(),
  checked_at: z.string().nullable(),
  source: z.enum(["manual", "plan"])
});
const recallSourceSchema = z.object({ last_success_at: z.string().nullable() });
const productMetadataRowSchema = z.object({
  product_id: z.uuid(),
  field_key: z.enum(["allergens", "additives", "structured_ingredients"]),
  value_json: z.unknown()
});
const foodRiskRowSchema = z.object({
  canonical_key: z.string(),
  kind: z.enum(["allergen", "intolerance", "exclusion", "medical"]),
  severity: z.enum(["notice", "avoid", "strict_avoid"])
});
const recallEventRowSchema = z.object({
  source_record_id: z.string(),
  status: z.enum(["active", "corrected", "withdrawn"]),
  product_name: z.string(),
  gtins: z.array(z.string()),
  lot_numbers: z.array(z.string()),
  source_url: z.url(),
  published_at: z.string(),
  retrieved_at: z.string()
});

const locationLabels: Record<z.infer<typeof inventoryRowSchema>["location"], InventoryItem["location"]> = {
  fridge: "Kühlschrank",
  freezer: "Gefrierfach",
  pantry: "Vorrat",
  drinks: "Getränke",
  other: "Sonstiges"
};

function berlinDate(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function mondayOf(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function plusDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatAmount(amount: number, unit: string): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(amount)} ${unit === "piece" ? "Stück" : unit}`;
}

function formatDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function metadataNames(rows: z.infer<typeof productMetadataRowSchema>[]): string[] {
  return rows.flatMap((row) => {
    if (row.field_key === "structured_ingredients") {
      return z.array(z.object({ name: z.string(), normalizedName: z.string().optional() }))
        .safeParse(row.value_json).data?.map((item) => item.normalizedName ?? item.name) ?? [];
    }
    return z.array(z.string()).safeParse(row.value_json).data ?? [];
  });
}

function recallForBatch(
  notices: RecallNotice[],
  batch: { gtin?: string; lotNumber?: string; productName: string },
  sourceStatus: "unavailable" | "fresh" | "stale",
  now: string
): RecallAssessment {
  const priority = { exact: 0, possible_gtin: 1, text_candidate: 2, none: 3, source_unavailable: 4 };
  const match = notices.map((notice) => assessRecall(notice, batch, now))
    .sort((left, right) => priority[left.kind] - priority[right.kind])[0];
  if (match && match.kind !== "none") return match;
  if (sourceStatus !== "fresh") return assessRecall(null, batch, now);
  return match ?? {
    kind: "none",
    blocksConsumption: false,
    stale: false,
    wording: "In den geladenen amtlichen Daten wurde kein Treffer gefunden. Das ist keine Sicherheitsgarantie."
  };
}

export type AppLoadResult =
  | { kind: "onboarding" }
  | { kind: "ready"; snapshot: AppSnapshot }
  | { kind: "error"; message: string };

export async function loadFoodOsSnapshot(supabase: SupabaseClient): Promise<AppLoadResult> {
  const membershipResult = await supabase
    .from("household_members")
    .select("household_id, households!inner(id, name)")
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) return { kind: "error", message: "Dein Haushalt konnte nicht geladen werden." };
  if (!membershipResult.data) return { kind: "onboarding" };
  const membership = membershipSchema.safeParse(membershipResult.data);
  if (!membership.success) return { kind: "error", message: "Der Haushaltsdatensatz hat ein unerwartetes Format." };

  const inventoryResult = await supabase
    .from("inventory_batches")
    .select("id, product_id, remaining_amount, unit, location, best_before_date, use_by_date, lot_number, products!inner(gtin, name, brand, image_url)")
    .eq("household_id", membership.data.household_id)
    .gt("remaining_amount", 0)
    .order("use_by_date", { ascending: true, nullsFirst: false })
    .order("best_before_date", { ascending: true, nullsFirst: false });
  if (inventoryResult.error) return { kind: "error", message: "Dein Vorrat konnte nicht geladen werden." };
  const parsedRows = z.array(inventoryRowSchema).safeParse(inventoryResult.data);
  if (!parsedRows.success) return { kind: "error", message: "Ein Vorratsdatensatz hat ein unerwartetes Format." };

  const productIds = [...new Set(parsedRows.data.map((row) => row.product_id))];
  const nutritionByProduct = new Map<string, z.infer<typeof nutritionRowSchema>>();
  if (productIds.length) {
    const nutritionResult = await supabase
      .from("product_nutrition")
      .select("product_id, energy_kcal, protein_g, carbohydrates_g, fat_g")
      .in("product_id", productIds);
    if (nutritionResult.error) return { kind: "error", message: "Nährwerte konnten nicht geladen werden." };
    const parsedNutrition = z.array(nutritionRowSchema).safeParse(nutritionResult.data);
    if (!parsedNutrition.success) return { kind: "error", message: "Ein Nährwertdatensatz hat ein unerwartetes Format." };
    parsedNutrition.data.forEach((row) => nutritionByProduct.set(row.product_id, row));
  }

  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) return { kind: "error", message: "Deine Sitzung konnte nicht bestätigt werden." };
  const today = berlinDate();
  const weekStart = mondayOf(today);
  const [nutritionSummaryResult, profileResult, mealPlanResult, shoppingListResult, recallSourceResult, foodRiskResult, metadataResult, recallEventsResult] = await Promise.all([
    supabase.rpc("get_my_nutrition_summary", { target_week_start: weekStart }),
    supabase.from("profiles").select("calorie_target, protein_target_g").maybeSingle(),
    supabase
      .from("meal_plan_slots")
      .select("id, product_id, planned_for, meal_type, servings, planned_amount, planned_unit, revision, products!inner(name)")
      .eq("household_id", membership.data.household_id)
      .gte("planned_for", weekStart)
      .lte("planned_for", plusDays(weekStart, 6))
      .order("planned_for", { ascending: true }),
    supabase
      .from("shopping_lists")
      .select("id, calculation_revision")
      .eq("household_id", membership.data.household_id)
      .eq("week_start", weekStart)
      .maybeSingle(),
    supabase
      .from("recall_sources")
      .select("last_success_at")
      .eq("approved", true)
      .order("last_success_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_food_risk_profiles").select("canonical_key, kind, severity"),
    productIds.length
      ? supabase.from("product_metadata").select("product_id, field_key, value_json").in("product_id", productIds).in("field_key", ["allergens", "additives", "structured_ingredients"])
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("recall_events")
      .select("source_record_id, status, product_name, gtins, lot_numbers, source_url, published_at, retrieved_at, recall_sources!inner(approved)")
      .eq("recall_sources.approved", true)
      .is("superseded_by", null)
      .order("published_at", { ascending: false })
      .limit(500)
  ]);
  if (nutritionSummaryResult.error || profileResult.error || mealPlanResult.error || shoppingListResult.error || recallSourceResult.error || foodRiskResult.error || metadataResult.error || recallEventsResult.error) return { kind: "error", message: "Tages-, Wochen-, Plan-, Einkaufs-, Risiko- oder Rückrufdaten konnten nicht geladen werden." };
  const parsedNutritionSummary = nutritionSummaryRowsSchema.safeParse(nutritionSummaryResult.data);
  const parsedProfile = profileSchema.nullable().safeParse(profileResult.data);
  const parsedMealPlan = z.array(mealPlanRowSchema).safeParse(mealPlanResult.data);
  const parsedShoppingList = shoppingListSchema.nullable().safeParse(shoppingListResult.data);
  const parsedRecallSource = recallSourceSchema.nullable().safeParse(recallSourceResult.data);
  const parsedFoodRisks = z.array(foodRiskRowSchema).safeParse(foodRiskResult.data);
  const parsedMetadata = z.array(productMetadataRowSchema).safeParse(metadataResult.data);
  const parsedRecallEvents = z.array(recallEventRowSchema).safeParse(recallEventsResult.data);
  if (!parsedNutritionSummary.success || !parsedProfile.success || !parsedMealPlan.success || !parsedShoppingList.success || !parsedRecallSource.success || !parsedFoodRisks.success || !parsedMetadata.success || !parsedRecallEvents.success) return { kind: "error", message: "Tages-, Wochen-, Plan-, Einkaufs-, Risiko- oder Rückrufdaten haben ein unerwartetes Format." };

  let nutritionSummary: ReturnType<typeof buildNutritionSummary>;
  try {
    nutritionSummary = buildNutritionSummary(parsedNutritionSummary.data, today);
  } catch {
    return { kind: "error", message: "Die Nährwert-Zusammenfassung ist unvollständig oder widersprüchlich." };
  }

  const recallSource = parsedRecallSource.data?.last_success_at ? {
    status: (Date.now() - new Date(parsedRecallSource.data.last_success_at).getTime() <= 48 * 60 * 60 * 1000 ? "fresh" : "stale") as "fresh" | "stale",
    lastSuccessAt: parsedRecallSource.data.last_success_at
  } : { status: "unavailable" as const };
  const preferences: FoodRiskPreference[] = parsedFoodRisks.data.map((risk) => ({ key: risk.canonical_key, kind: risk.kind, severity: risk.severity }));
  const metadataByProduct = new Map<string, z.infer<typeof productMetadataRowSchema>[]>();
  parsedMetadata.data.forEach((row) => metadataByProduct.set(row.product_id, [...(metadataByProduct.get(row.product_id) ?? []), row]));
  const recallNotices: RecallNotice[] = parsedRecallEvents.data.map((event) => ({
    sourceRecordId: event.source_record_id,
    status: event.status,
    productName: event.product_name,
    gtins: event.gtins,
    lotNumbers: event.lot_numbers,
    sourceUrl: event.source_url,
    publishedAt: event.published_at,
    retrievedAt: event.retrieved_at
  }));

  let parsedShoppingItems: z.infer<typeof shoppingItemSchema>[] = [];
  if (parsedShoppingList.data) {
    const shoppingItemsResult = await supabase
      .from("shopping_items")
      .select("id, label, required_amount, unit, checked_at, source")
      .eq("shopping_list_id", parsedShoppingList.data.id)
      .order("created_at", { ascending: true });
    if (shoppingItemsResult.error) return { kind: "error", message: "Die Einkaufsliste konnte nicht geladen werden." };
    const validatedItems = z.array(shoppingItemSchema).safeParse(shoppingItemsResult.data);
    if (!validatedItems.success) return { kind: "error", message: "Die Einkaufsliste hat ein unerwartetes Format." };
    parsedShoppingItems = validatedItems.data;
  }

  const inventory = parsedRows.data.map((row): InventoryItem => {
    const dateKind = row.use_by_date ? "use_by" : row.best_before_date ? "best_before" : undefined;
    const date = row.use_by_date ?? row.best_before_date;
    const expiry = dateKind ? classifyExpiry(dateKind, date, today) : { state: "unknown" as const, days: null };
    const nutrition = nutritionByProduct.get(row.product_id);
    return {
      id: row.id,
      productId: row.product_id,
      gtin: row.products.gtin ?? undefined,
      name: row.products.name,
      brand: row.products.brand ?? undefined,
      imageUrl: row.products.image_url ?? undefined,
      remainingLabel: formatAmount(row.remaining_amount, row.unit),
      remainingAmount: row.remaining_amount,
      unit: row.unit,
      location: locationLabels[row.location],
      dateKind,
      expiryDate: formatDate(date),
      daysUntilExpiry: expiry.days ?? undefined,
      expiryState: expiry.state,
      lotNumber: row.lot_number ?? undefined,
      personalRiskMatches: criticalFoodRiskMatches(metadataNames(metadataByProduct.get(row.product_id) ?? []), preferences),
      recall: recallForBatch(recallNotices, {
        gtin: row.products.gtin ?? undefined,
        lotNumber: row.lot_number ?? undefined,
        productName: row.products.name
      }, recallSource.status, new Date().toISOString()),
      nutrition: {
        kcal100g: nutrition?.energy_kcal ?? undefined,
        protein100g: nutrition?.protein_g ?? undefined,
        carbs100g: nutrition?.carbohydrates_g ?? undefined,
        fat100g: nutrition?.fat_g ?? undefined
      }
    };
  });

  return {
    kind: "ready",
    snapshot: {
      household: { id: membership.data.households.id, name: membership.data.households.name },
      inventory,
      today: {
        ...nutritionSummary.today,
        calorieTarget: parsedProfile.data?.calorie_target ?? undefined,
        proteinTargetG: parsedProfile.data?.protein_target_g ?? undefined
      },
      nutritionWeek: nutritionSummary.week,
      weekStart,
      mealPlan: parsedMealPlan.data.map((entry) => ({
        id: entry.id,
        productId: entry.product_id,
        plannedFor: entry.planned_for,
        mealType: entry.meal_type,
        servings: entry.servings,
        plannedAmount: entry.planned_amount,
        plannedUnit: entry.planned_unit,
        revision: entry.revision,
        productName: entry.products.name
      })),
      shoppingItems: parsedShoppingItems.map((entry) => ({
        id: entry.id,
        label: entry.label,
        requiredAmount: entry.required_amount ?? undefined,
        unit: entry.unit ?? undefined,
        checked: entry.checked_at !== null,
        source: entry.source
      })),
      shoppingCalculationRevision: parsedShoppingList.data?.calculation_revision ?? 0,
      recallSource
    }
  };
}
