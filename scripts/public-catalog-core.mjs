import { createHash } from "node:crypto";

const MAX_TEXT = 20_000;
const MAX_TAGS = 100;
const nutritionFields = {
  energy_kcal_100g: { sourceField: "energy-kcal_100g", maximum: 1_200 },
  proteins_100g: { sourceField: "proteins_100g", maximum: 100 },
  carbohydrates_100g: { sourceField: "carbohydrates_100g", maximum: 100 },
  sugars_100g: { sourceField: "sugars_100g", maximum: 100 },
  fat_100g: { sourceField: "fat_100g", maximum: 100 },
  "saturated-fat_100g": { sourceField: "saturated-fat_100g", maximum: 100 },
  fiber_100g: { sourceField: "fiber_100g", maximum: 100 },
  salt_100g: { sourceField: "salt_100g", maximum: 100 }
};

function text(value, maximum = 500) {
  if (typeof value !== "string") return undefined;
  const result = value.trim().replace(/\u0000/g, "");
  return result ? result.slice(0, maximum) : undefined;
}

function identifier(value, maximum = 500) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return text(String(value), maximum);
}

function textList(value, maximum = 160, count = MAX_TAGS) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(source.map((entry) => text(entry, maximum)).filter(Boolean))].slice(0, count);
}

function finiteNutrition(value, maximum) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 && number <= maximum ? number : undefined;
}

function sourceTimestamp(value) {
  const candidate = identifier(value, 80);
  if (!candidate) return undefined;
  const epoch = /^\d{9,13}$/.test(candidate) ? Number(candidate) : undefined;
  const date = epoch === undefined
    ? new Date(candidate)
    : new Date(epoch < 100_000_000_000 ? epoch * 1_000 : epoch);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function validNutriScore(value) {
  const score = text(value, 16)?.toLowerCase();
  return score && /^[a-e]$/.test(score) ? score : undefined;
}

function validNovaGroup(value) {
  const group = finiteNutrition(value, 4);
  return group !== undefined && Number.isInteger(group) && group >= 1 ? group : undefined;
}

function validGtin(value) {
  if (!/^\d{8,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  if (check === undefined) return false;
  const total = digits.reverse().reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === check;
}

function hasGermany(raw) {
  const countries = textList(raw.countries_tags, 160, 200).concat(textList(raw.countries, 160, 200));
  return countries.some((entry) => /^(?:(?:de|en):)?(?:germany|deutschland)$/i.test(entry));
}

function structuredIngredients(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = /** @type {Record<string, unknown>} */ (entry);
    const name = text(candidate.text, 500) ?? text(candidate.id, 500);
    const normalizedName = text(candidate.id, 240);
    const percentage = finiteNutrition(candidate.percent_estimate, 100);
    return name ? [{ name, ...(normalizedName ? { normalizedName } : {}), ...(percentage === undefined ? {} : { percentage }) }] : [];
  }).slice(0, 500);
}

/** @param {unknown} value */
export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return "null";
}

/** @param {unknown} value */
export function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/**
 * Normalizes a single Open Food Facts JSONL record to FoodOS's strict allowlist.
 * It does not make missing values up: absent/off-range values stay absent.
 *
 * @param {unknown} value
 * @returns {{ kind: "accepted", product: Record<string, unknown> } | { kind: "filtered" | "rejected", reason: string }}
 */
export function normalizePublicCatalogProduct(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "rejected", reason: "not-an-object" };
  const raw = /** @type {Record<string, unknown>} */ (value);
  const gtin = text(raw.code, 14);
  if (!gtin || !validGtin(gtin)) return { kind: "rejected", reason: "invalid-gtin" };
  if (!hasGermany(raw)) return { kind: "filtered", reason: "not-germany" };

  const germanName = text(raw.product_name_de, 240);
  const generalName = text(raw.product_name, 240);
  const genericName = text(raw.generic_name_de, 240) ?? text(raw.generic_name, 240);
  const name = germanName ?? generalName ?? genericName;
  if (!name) return { kind: "rejected", reason: "missing-name" };

  const nutriments = raw.nutriments && typeof raw.nutriments === "object" && !Array.isArray(raw.nutriments)
    ? /** @type {Record<string, unknown>} */ (raw.nutriments)
    : {};
  const nutrition = Object.fromEntries(Object.entries(nutritionFields).flatMap(([field, definition]) => {
    const number = finiteNutrition(nutriments[definition.sourceField], definition.maximum);
    return number === undefined ? [] : [[field, number]];
  }));
  const invalidNutrition = Object.values(nutritionFields).some((definition) => {
    const rawValue = nutriments[definition.sourceField];
    return rawValue !== undefined && finiteNutrition(rawValue, definition.maximum) === undefined;
  });
  if (invalidNutrition) return { kind: "rejected", reason: "invalid-nutrition" };

  const sourceUpdatedAt = sourceTimestamp(raw.last_modified_datetime) ?? sourceTimestamp(raw.last_modified_t);
  const sourceRevision = identifier(raw.last_modified_t, 40) ?? text(raw.last_modified_datetime, 80) ?? text(raw._id, 80) ?? gtin;
  const retrievedAt = new Date().toISOString();
  const imageUrl = text(raw.image_front_url, 2_000) ?? text(raw.image_front_small_url, 2_000);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) return { kind: "rejected", reason: "invalid-image-url" };

  const product = {
    gtin,
    name,
    name_de: germanName,
    generic_name: genericName,
    brand: text(raw.brands, 240),
    package_quantity: text(raw.quantity, 120),
    serving_size: text(raw.serving_size, 120),
    image_url: imageUrl,
    ingredients_text: text(raw.ingredients_text_de, MAX_TEXT) ?? text(raw.ingredients_text, MAX_TEXT),
    structured_ingredients: structuredIngredients(raw.ingredients),
    allergens: textList(raw.allergens_tags),
    traces: textList(raw.traces_tags),
    additives: textList(raw.additives_tags, 80),
    categories: textList(raw.categories_tags),
    labels: textList(raw.labels_tags),
    countries: textList(raw.countries_tags),
    packaging: textList(raw.packaging_tags),
    stores: textList(raw.stores_tags ?? raw.stores),
    origins: textList(raw.origins_tags ?? raw.origins),
    nutrition_per_100g: nutrition,
    nutri_score: validNutriScore(raw.nutriscore_grade),
    nova_group: validNovaGroup(raw.nova_group),
    environmental_score: text(raw.ecoscore_grade, 16)?.toLowerCase() ?? text(raw.environmental_score, 16)?.toLowerCase(),
    completeness: (() => {
      const value = finiteNutrition(raw.completeness, 100);
      return value === undefined ? undefined : value / 100;
    })(),
    confidence: germanName ? 0.9 : 0.78,
    source_provider: "open-food-facts",
    source_url: `https://world.openfoodfacts.org/product/${gtin}`,
    source_language: text(raw.lang, 16),
    source_schema_version: "off-jsonl-v3.6-compatible",
    source_revision: sourceRevision,
    source_updated_at: sourceUpdatedAt,
    source_retrieved_at: retrievedAt,
    field_provenance: {
      source: "open-food-facts-jsonl",
      source_fields: [
        "code", "product_name_de", "product_name", "generic_name_de", "generic_name", "brands", "quantity", "serving_size",
        "image_front_url", "image_front_small_url", "ingredients_text_de", "ingredients_text", "ingredients", "allergens_tags",
        "traces_tags", "additives_tags", "categories_tags", "labels_tags", "countries_tags", "packaging_tags", "stores_tags",
        "origins_tags", "origins", "nutriments", "nutriscore_grade", "nova_group", "ecoscore_grade", "completeness", "lang", "last_modified_datetime", "last_modified_t"
      ]
    },
    database_license: "ODbL-1.0; DbCL-1.0",
    image_license: imageUrl ? "CC-BY-SA-4.0 (verify image-specific rights before reuse)" : "not-applicable"
  };
  const definedProduct = Object.fromEntries(Object.entries(product).filter(([, fieldValue]) => fieldValue !== undefined));
  const contentProjection = Object.fromEntries(Object.entries(definedProduct)
    .filter(([field]) => field !== "source_retrieved_at"));
  return {
    kind: "accepted",
    product: { ...definedProduct, normalized_content_sha256: sha256(contentProjection) }
  };
}

export function catalogRowForInsert(product, importRunId) {
  return {
    ...product,
    import_run_id: importRunId
  };
}
