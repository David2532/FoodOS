import type { IngredientAssessment, Product, RiskLevel } from "./types";

type UnknownRecord = Record<string, unknown>;

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

export function normalizeOpenFoodFacts(raw: UnknownRecord, barcode: string): Product {
  const product = (raw.product && typeof raw.product === "object" ? raw.product : {}) as UnknownRecord;
  const nutriments = (product.nutriments && typeof product.nutriments === "object" ? product.nutriments : {}) as UnknownRecord;

  return {
    barcode,
    name: text(product.product_name_de) ?? text(product.product_name) ?? text(product.generic_name_de) ?? "Unbekanntes Produkt",
    brand: text(product.brands),
    imageUrl: text(product.image_front_small_url) ?? text(product.image_front_url),
    quantity: text(product.quantity),
    ingredientsText: text(product.ingredients_text_de) ?? text(product.ingredients_text),
    allergens: strings(product.allergens_tags).map(cleanTag),
    traces: strings(product.traces_tags).map(cleanTag),
    labels: strings(product.labels_tags).map(cleanTag).slice(0, 8),
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
    confidence: text(product.product_name) || text(product.product_name_de) ? 0.82 : 0.42
  };
}
