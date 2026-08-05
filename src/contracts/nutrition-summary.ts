import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableNutritionValueSchema = z.coerce.number().finite().nonnegative().nullable();
const countSchema = z.coerce.number().int().nonnegative();

export const nutritionSummaryRowSchema = z.object({
  summary_date: dateOnlySchema,
  entry_count: countSchema,
  kcal: nullableNutritionValueSchema,
  kcal_known_count: countSchema,
  protein_g: nullableNutritionValueSchema,
  protein_known_count: countSchema,
  carbohydrates_g: nullableNutritionValueSchema,
  carbohydrates_known_count: countSchema,
  fat_g: nullableNutritionValueSchema,
  fat_known_count: countSchema
}).strict();

export const nutritionSummaryRowsSchema = z.array(nutritionSummaryRowSchema).length(7);

export type NutritionSummaryRow = z.infer<typeof nutritionSummaryRowSchema>;
