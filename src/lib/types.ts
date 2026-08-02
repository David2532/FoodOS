export type AppView = "today" | "inventory" | "scan" | "plan" | "shopping";

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
  ingredientsText?: string;
  allergens: string[];
  traces: string[];
  labels: string[];
  nutrition: ProductNutrition;
  assessments: IngredientAssessment[];
  source: "open-food-facts" | "manual" | "cache";
  confidence: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  brand?: string;
  emoji: string;
  remainingLabel: string;
  location: "Kühlschrank" | "Gefrierfach" | "Vorrat";
  bestBefore?: string;
  daysUntilExpiry?: number;
  accent: string;
}
