import { z } from "zod";

export const planningUnitSchema = z.enum(["g", "ml", "piece"]);

export const mealPlanMutationResultSchema = z.object({
  id: z.uuid(),
  revision: z.coerce.number().int().positive(),
  idempotent_replay: z.boolean()
}).strict();

export const mealPlanDeleteResultSchema = z.object({
  id: z.uuid(),
  deleted_revision: z.coerce.number().int().positive(),
  idempotent_replay: z.boolean()
}).strict();

export const shoppingGenerationResultSchema = z.object({
  list_id: z.uuid(),
  calculation_revision: z.coerce.number().int().positive(),
  calculation_payload_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  idempotent_replay: z.boolean()
}).strict();

export type PlanningUnit = z.infer<typeof planningUnitSchema>;
export type MealPlanMutationResult = z.infer<typeof mealPlanMutationResultSchema>;
export type MealPlanDeleteResult = z.infer<typeof mealPlanDeleteResultSchema>;
export type ShoppingGenerationResult = z.infer<typeof shoppingGenerationResultSchema>;
