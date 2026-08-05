import { z } from "zod";

export const inventoryBatchInputSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  unit: z.enum(["g", "ml", "piece"]),
  location: z.enum(["fridge", "freezer", "pantry", "drinks", "other"]),
  dateKind: z.enum(["best_before", "use_by", "none"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  lotNumber: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  purchasePriceCents: z.coerce.number().int().nonnegative().max(100_000_000).optional()
}).superRefine((value, context) => {
  if (value.dateKind !== "none" && !value.date) {
    context.addIssue({ code: "custom", path: ["date"], message: "Ergänze das bestätigte Datum." });
  }
});

export const addBatchResultSchema = z.object({
  batch_id: z.uuid(),
  product_id: z.uuid().optional(),
  remaining_amount: z.coerce.number().optional(),
  idempotent_replay: z.boolean()
});

export const consumptionInputSchema = z.object({
  batchId: z.uuid(),
  amount: z.coerce.number().positive().max(1_000_000)
});

export const consumeBatchResultSchema = z.object({
  batch_id: z.uuid(),
  remaining_amount: z.coerce.number().nonnegative(),
  nutrition: z.record(z.string(), z.unknown()).optional(),
  idempotent_replay: z.boolean()
});

export type InventoryBatchInput = z.infer<typeof inventoryBatchInputSchema>;
