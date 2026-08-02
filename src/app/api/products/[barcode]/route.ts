import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeOpenFoodFacts } from "@/lib/open-food-facts";

const barcodeSchema = z.string().regex(/^\d{8,14}$/, "Barcode muss 8 bis 14 Ziffern enthalten.");
const fields = [
  "code", "product_name", "product_name_de", "generic_name_de", "brands", "quantity",
  "image_front_url", "image_front_small_url", "ingredients_text", "ingredients_text_de",
  "allergens_tags", "traces_tags", "additives_tags", "labels_tags", "nutriments"
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
      next: { revalidate: 60 * 60 * 24 * 7 }
    });
    if (!response.ok) continue;
    const body = (await response.json()) as Record<string, unknown>;
    if (body.product) return body;
  }
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode: rawBarcode } = await context.params;
  const parsed = barcodeSchema.safeParse(rawBarcode);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültiger Barcode." }, { status: 400 });
  }

  try {
    const raw = await fetchProduct(parsed.data);
    if (!raw) return NextResponse.json({ error: "Produkt nicht gefunden.", barcode: parsed.data }, { status: 404 });
    return NextResponse.json({ product: normalizeOpenFoodFacts(raw, parsed.data) });
  } catch {
    return NextResponse.json({ error: "Produktdaten sind gerade nicht erreichbar." }, { status: 503 });
  }
}
