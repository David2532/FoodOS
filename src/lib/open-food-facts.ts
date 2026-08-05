import { z } from "zod";
import type { IngredientAssessment, Product, RiskLevel } from "./types";

type UnknownRecord = Record<string, unknown>;

const ingredientSchema = z.object({
  id: z.string().optional(),
  text: z.string().optional(),
  percent_estimate: z.number().min(0).max(100).optional()
});

const openFoodFactsResponseSchema = z.object({
  product: z.object({
    product_name_de: z.string().optional(),
    product_name: z.string().optional(),
    generic_name_de: z.string().optional(),
    brands: z.string().optional(),
    quantity: z.string().optional(),
    serving_size: z.string().optional(),
    image_front_url: z.string().url().optional(),
    image_front_small_url: z.string().url().optional(),
    ingredients_text: z.string().optional(),
    ingredients_text_de: z.string().optional(),
    ingredients: z.array(ingredientSchema).optional(),
    allergens_tags: z.array(z.string()).optional(),
    traces_tags: z.array(z.string()).optional(),
    additives_tags: z.array(z.string()).optional(),
    labels_tags: z.array(z.string()).optional(),
    categories_tags: z.array(z.string()).optional(),
    countries_tags: z.array(z.string()).optional(),
    nutriscore_grade: z.string().optional(),
    nova_group: z.number().int().optional(),
    lang: z.string().optional(),
    nutriments: z.record(z.string(), z.unknown()).optional()
  })
});

const euAdditiveNotes: Record<string, { level: RiskLevel; reason: string }> = {
  "e102": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e104": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e110": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e122": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e124": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e129": { level: "info", reason: "Für diesen Farbstoff ist in der EU ein besonderer Hinweis für Kinder vorgeschrieben." },
  "e951": { level: "info", reason: "Enthält Aspartam; für Menschen mit Phenylketonurie ist der Phenylalanin-Hinweis entscheidend." }
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanTag(value: string) {
  return value.replace(/^[a-z]{2}:/i, "").replaceAll("-", " ").trim();
}

function assessIngredients(product: UnknownRecord): IngredientAssessment[] {
  const additives = strings(product.additives_tags);
  const allergens = strings(product.allergens_tags);
  const assessments: IngredientAssessment[] = [];

  for (const allergen of allergens) {
    assessments.push({
      name: cleanTag(allergen),
      level: "info",
      reason: "Kennzeichnungspflichtiges Allergen. Erst nach Bestätigung im persönlichen Profil wird daraus eine rote Warnung.",
      sourceLabel: "EU-Allergenkennzeichnung",
      confidence: 0.95
    });
  }

  for (const additive of additives) {
    const normalized = cleanTag(additive).replaceAll(" ", "").toLowerCase();
    const note = euAdditiveNotes[normalized];
    assessments.push({
      name: normalized.toUpperCase(),
      eNumber: normalized.toUpperCase(),
      level: note?.level ?? "ok",
      reason: note?.reason ?? "Als Zusatzstoff erfasst. Ohne deklarierte Stoffmenge wird kein scheinpräziser Risiko-Score berechnet.",
      sourceLabel: note ? "EU-Kennzeichnung" : "Open Food Facts / EU-Zusatzstoffkontext",
      confidence: 0.82
    });
  }

  return assessments.sort((a, b) => {
    const rank: Record<RiskLevel, number> = { avoid: 0, watch: 1, info: 2, unknown: 3, ok: 4 };
    return rank[a.level] - rank[b.level];
  });
}

export function normalizeOpenFoodFacts(raw: unknown, barcode: string, retrievedAt = new Date().toISOString()): Product {
  const validated = openFoodFactsResponseSchema.parse(raw);
  const product: UnknownRecord = validated.product;
  const nutriments = validated.product.nutriments ?? {};
  const imageUrl = text(product.image_front_small_url) ?? text(product.image_front_url);

  return {
    barcode,
    name: text(product.product_name_de) ?? text(product.product_name) ?? text(product.generic_name_de) ?? "Unbekanntes Produkt",
    brand: text(product.brands),
    imageUrl,
    quantity: text(product.quantity),
    servingSize: text(product.serving_size),
    categories: strings(product.categories_tags).map(cleanTag).slice(0, 40),
    countries: strings(product.countries_tags).map(cleanTag).slice(0, 40),
    ingredientsText: text(product.ingredients_text_de) ?? text(product.ingredients_text),
    structuredIngredients: validated.product.ingredients?.map((ingredient) => ({
      name: ingredient.text ?? cleanTag(ingredient.id ?? "unbekannt"),
      normalizedName: ingredient.id ? cleanTag(ingredient.id) : undefined,
      percentage: ingredient.percent_estimate
    })) ?? [],
    allergens: strings(product.allergens_tags).map(cleanTag),
    traces: strings(product.traces_tags).map(cleanTag),
    additives: strings(product.additives_tags).map(cleanTag),
    labels: strings(product.labels_tags).map(cleanTag).slice(0, 8),
    nutriScore: text(product.nutriscore_grade),
    novaGroup: number(product.nova_group),
    nutrition: {
      kcal100g: number(nutriments["energy-kcal_100g"]),
      protein100g: number(nutriments.proteins_100g),
      carbs100g: number(nutriments.carbohydrates_100g),
      fat100g: number(nutriments.fat_100g),
      sugar100g: number(nutriments.sugars_100g),
      saturatedFat100g: number(nutriments["saturated-fat_100g"]),
      fiber100g: number(nutriments.fiber_100g),
      salt100g: number(nutriments.salt_100g)
    },
    assessments: assessIngredients(product),
    source: "open-food-facts",
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    sourceLanguage: text(product.lang),
    databaseLicense: "ODbL-1.0; DbCL-1.0",
    imageLicense: imageUrl ? "CC-BY-SA-4.0" : undefined,
    retrievedAt,
    confidence: text(product.product_name) || text(product.product_name_de) ? 0.82 : 0.42
  };
}
