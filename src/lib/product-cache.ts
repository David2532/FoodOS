import { z } from "zod";
import { assessIngredientFacts } from "../domain/ingredient-relevance";
import type { IngredientAssessment, Product } from "./types";

const nutritionSchema = z.object({
  energy_kcal: z.coerce.number().nullable(),
  protein_g: z.coerce.number().nullable(),
  carbohydrates_g: z.coerce.number().nullable(),
  sugars_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable(),
  saturated_fat_g: z.coerce.number().nullable(),
  fiber_g: z.coerce.number().nullable(),
  salt_g: z.coerce.number().nullable()
});

const cachedProductRowSchema = z.object({
  gtin: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  ingredients_text: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  data_confidence: z.coerce.number(),
  product_nutrition: z.union([nutritionSchema, z.array(nutritionSchema).max(1)]).nullable(),
  product_metadata: z.array(z.object({ field_key: z.string(), value_json: z.unknown() }))
});

function relation<T>(value: T | T[] | null): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function stringList(value: unknown): string[] {
  return z.array(z.string()).safeParse(value).data ?? [];
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeCachedProduct(raw: unknown): Product {
  const row = cachedProductRowSchema.parse(raw);
  const metadata = new Map(row.product_metadata.map((entry) => [entry.field_key, entry.value_json]));
  const details = z.record(z.string(), z.unknown()).safeParse(metadata.get("catalog_details")).data ?? {};
  const structuredIngredients = z.array(z.object({
    name: z.string(),
    normalizedName: z.string().optional(),
    percentage: z.number().optional()
  })).safeParse(metadata.get("structured_ingredients")).data ?? [];
  const allergens = stringList(metadata.get("allergens"));
  const additives = stringList(metadata.get("additives"));
  const assessments: IngredientAssessment[] = assessIngredientFacts([
    ...allergens.map((name) => ({ name, normalizedName: name, allergen: true, confidence: .95, sourceLabel: "Gespeicherte Produktkennzeichnung" })),
    ...structuredIngredients.map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.normalizedName, allergen: false, confidence: .82, sourceLabel: "Gespeicherte Zutatenliste" })),
    ...additives.map((name) => ({ name, normalizedName: name, eNumber: name.toUpperCase(), allergen: false, confidence: .82, sourceLabel: "Gespeicherte Zusatzstoffkennzeichnung" }))
  ], []);
  const nutrition = relation(row.product_nutrition);

  return {
    barcode: row.gtin,
    name: row.name,
    brand: row.brand ?? undefined,
    imageUrl: row.image_url ?? undefined,
    quantity: optionalText(details.quantity),
    categories: stringList(metadata.get("categories")),
    countries: stringList(metadata.get("countries")),
    ingredientsText: row.ingredients_text ?? undefined,
    structuredIngredients,
    allergens,
    traces: stringList(metadata.get("traces")),
    additives,
    labels: stringList(metadata.get("labels")),
    nutriScore: optionalText(details.nutri_score),
    novaGroup: optionalNumber(details.nova_group),
    servingSize: optionalText(details.serving_size),
    nutrition: {
      kcal100g: nutrition?.energy_kcal ?? undefined,
      protein100g: nutrition?.protein_g ?? undefined,
      carbs100g: nutrition?.carbohydrates_g ?? undefined,
      sugar100g: nutrition?.sugars_g ?? undefined,
      fat100g: nutrition?.fat_g ?? undefined,
      saturatedFat100g: nutrition?.saturated_fat_g ?? undefined,
      fiber100g: nutrition?.fiber_g ?? undefined,
      salt100g: nutrition?.salt_g ?? undefined
    },
    assessments,
    source: "cache",
    sourceUrl: optionalText(details.source_url),
    sourceLanguage: optionalText(details.source_language),
    retrievedAt: row.source_updated_at ?? new Date(0).toISOString(),
    confidence: row.data_confidence
  };
}
