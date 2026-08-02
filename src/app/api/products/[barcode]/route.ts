import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeOpenFoodFacts } from "@/lib/open-food-facts";
import { productApiResponseSchema } from "@/contracts/product";
import { normalizeCachedProduct } from "@/lib/product-cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const barcodeSchema = z.string().regex(/^\d{8,14}$/, "Barcode muss 8 bis 14 Ziffern enthalten.");
const fields = [
  "code", "product_name", "product_name_de", "generic_name_de", "brands", "quantity",
  "image_front_url", "image_front_small_url", "ingredients_text", "ingredients_text_de",
  "serving_size", "ingredients", "allergens_tags", "traces_tags", "additives_tags",
  "labels_tags", "categories_tags", "countries_tags", "nutriscore_grade", "nova_group",
  "lang", "nutriments"
].join(",");

async function fetchProduct(barcode: string) {
  const userAgent = process.env.OPEN_FOOD_FACTS_USER_AGENT ?? "FoodOS/0.1 (personal nutrition inventory app)";
  const endpoints = [
    `https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=${fields}`,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
      next: { revalidate: 60 * 60 * 24 * 7 }
    });
    if (!response.ok) continue;
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "product" in body) return body;
  }
  return null;
}

async function findCachedProduct(barcode: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("products")
    .select("gtin, name, brand, image_url, ingredients_text, source_updated_at, data_confidence, product_nutrition(energy_kcal, protein_g, carbohydrates_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g), product_metadata(field_key, value_json)")
    .eq("gtin", barcode)
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return normalizeCachedProduct(result.data);
}

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode: rawBarcode } = await context.params;
  const parsed = barcodeSchema.safeParse(rawBarcode);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültiger Barcode." }, { status: 400 });
  }

  try {
    const cached = await findCachedProduct(parsed.data);
    if (cached) {
      const response = productApiResponseSchema.parse({ product: cached });
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-FoodOS-Product-Source": "cache"
        }
      });
    }
    const raw = await fetchProduct(parsed.data);
    if (!raw) return NextResponse.json({ error: "Produkt nicht gefunden.", barcode: parsed.data }, { status: 404 });
    const response = productApiResponseSchema.parse({ product: normalizeOpenFoodFacts(raw, parsed.data) });
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-FoodOS-Product-Source": "open-food-facts"
      }
    });
  } catch {
    return NextResponse.json({ error: "Produktdaten sind gerade nicht erreichbar." }, { status: 503 });
  }
}
