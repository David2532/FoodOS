import { z } from "zod";
import { productNutritionSchema } from "./product";

export const catalogSearchQuerySchema = z.object({
  query: z.string().trim().min(2, "Gib mindestens zwei Zeichen ein.").max(80),
  page: z.coerce.number().int().min(1).max(100).default(1)
});

export const catalogSearchItemSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string().min(1).max(240),
  brand: z.string().max(240).optional(),
  quantity: z.string().max(120).optional(),
  imageUrl: z.url().optional(),
  nutriScore: z.enum(["a", "b", "c", "d", "e"]).optional(),
  nutrition: productNutritionSchema,
  source: z.enum(["household-cache", "global-catalog", "open-food-facts"]),
  confidence: z.number().min(0).max(1),
  sourceUrl: z.url().optional(),
  sourceUpdatedAt: z.iso.datetime().optional(),
  sourceRetrievedAt: z.iso.datetime().optional(),
  databaseLicense: z.string().max(160).optional(),
  imageLicense: z.string().max(160).optional()
});

export const catalogSearchResponseSchema = z.object({
  query: z.string(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  providerCount: z.number().int().nonnegative(),
  providerCountExact: z.boolean(),
  cachedCount: z.number().int().nonnegative(),
  globalCatalogCount: z.number().int().nonnegative(),
  globalCatalogStatus: z.enum(["live", "unavailable", "not-configured"]),
  providerStatus: z.enum(["live", "unavailable", "not-needed"]),
  hasMore: z.boolean(),
  results: z.array(catalogSearchItemSchema).max(20)
});

export type CatalogSearchItem = z.infer<typeof catalogSearchItemSchema>;
export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;
