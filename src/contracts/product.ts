import { z } from "zod";

const optionalNumber = z.number().finite().nonnegative().optional();

export const ingredientAssessmentSchema = z.object({
  name: z.string().min(1).max(240),
  originalName: z.string().max(500).optional(),
  eNumber: z.string().max(32).optional(),
  level: z.enum(["avoid", "watch", "info", "ok", "unknown"]),
  reason: z.string().min(1).max(1000),
  sourceLabel: z.string().max(240).optional(),
  confidence: z.number().min(0).max(1)
});

export const productSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string().min(1).max(240),
  brand: z.string().max(240).optional(),
  imageUrl: z.url().optional(),
  quantity: z.string().max(120).optional(),
  categories: z.array(z.string().max(160)).max(40),
  countries: z.array(z.string().max(120)).max(40),
  labels: z.array(z.string().max(120)).max(40),
  ingredientsText: z.string().max(20_000).optional(),
  structuredIngredients: z.array(z.object({
    name: z.string().min(1).max(500),
    normalizedName: z.string().max(240).optional(),
    percentage: z.number().min(0).max(100).optional()
  })).max(500),
  allergens: z.array(z.string().max(160)).max(100),
  traces: z.array(z.string().max(160)).max(100),
  additives: z.array(z.string().max(80)).max(100),
  nutriScore: z.string().max(16).optional(),
  novaGroup: z.number().int().min(1).max(4).optional(),
  servingSize: z.string().max(120).optional(),
  nutrition: z.object({
    kcal100g: optionalNumber,
    protein100g: optionalNumber,
    carbs100g: optionalNumber,
    fat100g: optionalNumber,
    sugar100g: optionalNumber,
    saturatedFat100g: optionalNumber,
    fiber100g: optionalNumber,
    salt100g: optionalNumber
  }),
  assessments: z.array(ingredientAssessmentSchema).max(200),
  source: z.enum(["open-food-facts", "manual", "cache"]),
  sourceUrl: z.url().optional(),
  sourceLanguage: z.string().max(16).optional(),
  retrievedAt: z.iso.datetime(),
  confidence: z.number().min(0).max(1)
});

export const productApiResponseSchema = z.object({ product: productSchema });
