import type { NutritionDaySummary, NutritionWeekSummary } from "@/domain/nutrition-summary";
import type { MealSuggestion } from "@/domain/meal-suggestions";
import type {
  HouseholdMemberRow,
  HouseholdSummaryRow,
  PendingHouseholdInvitationRow
} from "@/contracts/household-membership";

export type AppView = "today" | "inventory" | "scan" | "plan" | "shopping" | "settings";

export type RiskLevel = "avoid" | "watch" | "info" | "ok" | "unknown";

export interface IngredientAssessment {
  name: string;
  originalName?: string;
  eNumber?: string;
  level: RiskLevel;
  reason: string;
  sourceLabel?: string;
  confidence: number;
}

export interface ProductNutrition {
  kcal100g?: number;
  protein100g?: number;
  carbs100g?: number;
  fat100g?: number;
  sugar100g?: number;
  saturatedFat100g?: number;
  fiber100g?: number;
  salt100g?: number;
}

export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  quantity?: string;
  categories: string[];
  countries: string[];
  ingredientsText?: string;
  structuredIngredients: Array<{ name: string; normalizedName?: string; percentage?: number }>;
  allergens: string[];
  traces: string[];
  additives: string[];
  labels: string[];
  nutriScore?: string;
  novaGroup?: number;
  servingSize?: string;
  nutrition: ProductNutrition;
  assessments: IngredientAssessment[];
  source: "open-food-facts" | "global-catalog" | "manual" | "cache";
  sourceUrl?: string;
  sourceLanguage?: string;
  sourceUpdatedAt?: string;
  databaseLicense?: string;
  imageLicense?: string;
  retrievedAt: string;
  confidence: number;
}

export interface InventoryItem {
  id: string;
  productId: string;
  gtin?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  remainingLabel: string;
  remainingAmount: number;
  unit: "g" | "ml" | "piece";
  location: "Kühlschrank" | "Gefrierfach" | "Vorrat" | "Getränke" | "Sonstiges";
  dateKind?: "best_before" | "use_by";
  expiryDate?: string;
  daysUntilExpiry?: number;
  expiryState: "future" | "soon" | "today" | "past_best_before" | "past_use_by" | "unknown";
  lotNumber?: string;
  personalRiskMatches: string[];
  recall: {
    kind: "exact" | "possible_gtin" | "text_candidate" | "none" | "source_unavailable";
    blocksConsumption: boolean;
    stale: boolean;
    wording: string;
    sourceUrl?: string;
  };
  nutrition: ProductNutrition;
}

export interface MealPlanItem {
  id: string;
  productId: string;
  plannedFor: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  plannedAmount: number;
  plannedUnit: "g" | "ml" | "piece";
  revision: number;
  productName: string;
}

export interface ShoppingItem {
  id: string;
  label: string;
  requiredAmount?: number;
  unit?: string;
  checked: boolean;
  source: "manual" | "plan";
}

export interface AppSnapshot {
  currentUserId: string;
  household: { id: string; name: string };
  households: HouseholdSummaryRow[];
  householdMembers: HouseholdMemberRow[];
  pendingHouseholdInvitations: PendingHouseholdInvitationRow[];
  inventory: InventoryItem[];
  today: NutritionDaySummary & {
    calorieTarget?: number;
    proteinTargetG?: number;
  };
  nutritionWeek: NutritionWeekSummary;
  weekStart: string;
  mealPlan: MealPlanItem[];
  mealSuggestions: MealSuggestion[];
  mealSuggestionRecipeCount: number;
  shoppingItems: ShoppingItem[];
  shoppingCalculationRevision?: number;
  recallSource: {
    status: "unavailable" | "fresh" | "stale";
    lastSuccessAt?: string;
  };
}
