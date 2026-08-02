import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyExpiry } from "@/domain/expiry";
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
  products: z.object({ name: z.string(), brand: z.string().nullable(), image_url: z.string().nullable() })
});

const nutritionRowSchema = z.object({
  product_id: z.uuid(),
  energy_kcal: z.coerce.number().nullable(),
  protein_g: z.coerce.number().nullable(),
  carbohydrates_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable()
});

const foodLogSchema = z.object({
  eaten_at: z.string(),
  nutrition_snapshot: z.record(z.string(), z.unknown())
});

const profileSchema = z.object({
  calorie_target: z.coerce.number().nullable(),
  protein_target_g: z.coerce.number().nullable()
});

const mealPlanRowSchema = z.object({
  id: z.uuid(),
  planned_for: z.string(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  servings: z.coerce.number(),
  products: z.object({ name: z.string() })
});

const shoppingListSchema = z.object({ id: z.uuid() });
const shoppingItemSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  required_amount: z.coerce.number().nullable(),
  unit: z.string().nullable(),
  checked_at: z.string().nullable(),
  source: z.enum(["manual", "plan"])
});
const recallSourceSchema = z.object({ last_success_at: z.string().nullable() });

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

function snapshotNumber(snapshot: Record<string, unknown>, key: string): number {
  const value = snapshot[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function formatAmount(amount: number, unit: string): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(amount)} ${unit === "piece" ? "Stück" : unit}`;
}

function formatDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(Date.UTC(year, month - 1, day)));
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
    .select("id, product_id, remaining_amount, unit, location, best_before_date, use_by_date, lot_number, products!inner(name, brand, image_url)")
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
  const recentBoundary = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const [foodLogResult, profileResult, mealPlanResult, shoppingListResult, recallSourceResult] = await Promise.all([
    supabase
      .from("food_log_entries")
      .select("eaten_at, nutrition_snapshot")
      .eq("user_id", userResult.data.user.id)
      .gte("eaten_at", recentBoundary),
    supabase.from("profiles").select("calorie_target, protein_target_g").maybeSingle(),
    supabase
      .from("meal_plan_slots")
      .select("id, planned_for, meal_type, servings, products!inner(name)")
      .eq("household_id", membership.data.household_id)
      .eq("user_id", userResult.data.user.id)
      .gte("planned_for", weekStart)
      .lte("planned_for", plusDays(weekStart, 6))
      .order("planned_for", { ascending: true }),
    supabase
      .from("shopping_lists")
      .select("id")
      .eq("household_id", membership.data.household_id)
      .eq("week_start", weekStart)
      .maybeSingle(),
    supabase
      .from("recall_sources")
      .select("last_success_at")
      .eq("approved", true)
      .order("last_success_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (foodLogResult.error || profileResult.error || mealPlanResult.error || shoppingListResult.error || recallSourceResult.error) return { kind: "error", message: "Tages-, Plan-, Einkaufs- oder Rückrufdaten konnten nicht geladen werden." };
  const parsedLogs = z.array(foodLogSchema).safeParse(foodLogResult.data);
  const parsedProfile = profileSchema.nullable().safeParse(profileResult.data);
  const parsedMealPlan = z.array(mealPlanRowSchema).safeParse(mealPlanResult.data);
  const parsedShoppingList = shoppingListSchema.nullable().safeParse(shoppingListResult.data);
  const parsedRecallSource = recallSourceSchema.nullable().safeParse(recallSourceResult.data);
  if (!parsedLogs.success || !parsedProfile.success || !parsedMealPlan.success || !parsedShoppingList.success || !parsedRecallSource.success) return { kind: "error", message: "Tages-, Plan-, Einkaufs- oder Rückrufdaten haben ein unerwartetes Format." };

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
      nutrition: {
        kcal100g: nutrition?.energy_kcal ?? undefined,
        protein100g: nutrition?.protein_g ?? undefined,
        carbs100g: nutrition?.carbohydrates_g ?? undefined,
        fat100g: nutrition?.fat_g ?? undefined
      }
    };
  });

  const todayLogs = parsedLogs.data.filter((entry) => berlinDate(new Date(entry.eaten_at)) === today);
  const dailyTotals = todayLogs.reduce((totals, entry) => ({
    kcal: totals.kcal + snapshotNumber(entry.nutrition_snapshot, "kcal"),
    proteinG: totals.proteinG + snapshotNumber(entry.nutrition_snapshot, "protein_g"),
    carbsG: totals.carbsG + snapshotNumber(entry.nutrition_snapshot, "carbohydrates_g"),
    fatG: totals.fatG + snapshotNumber(entry.nutrition_snapshot, "fat_g")
  }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  return {
    kind: "ready",
    snapshot: {
      household: { id: membership.data.households.id, name: membership.data.households.name },
      inventory,
      today: {
        ...dailyTotals,
        calorieTarget: parsedProfile.data?.calorie_target ?? undefined,
        proteinTargetG: parsedProfile.data?.protein_target_g ?? undefined
      },
      weekStart,
      mealPlan: parsedMealPlan.data.map((entry) => ({
        id: entry.id,
        plannedFor: entry.planned_for,
        mealType: entry.meal_type,
        servings: entry.servings,
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
      recallSource: parsedRecallSource.data?.last_success_at ? {
        status: Date.now() - new Date(parsedRecallSource.data.last_success_at).getTime() <= 48 * 60 * 60 * 1000 ? "fresh" : "stale",
        lastSuccessAt: parsedRecallSource.data.last_success_at
      } : { status: "unavailable" }
    }
  };
}
