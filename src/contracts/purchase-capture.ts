import { z } from "zod";
import { productSchema } from "./product";

export const purchaseCaptureItemSchema = z.object({
  item_mutation_id: z.uuid(),
  product_payload: productSchema,
  batch_payload: z.object({
    amount: z.number().int().positive().max(999),
    unit: z.literal("piece"),
    location: z.enum(["fridge", "freezer", "pantry", "drinks", "other"]),
    best_before_date: z.iso.date().nullable(),
    use_by_date: z.iso.date().nullable(),
    lot_number: z.string().trim().max(120).nullable(),
    serial_number: z.string().trim().max(120).nullable(),
    purchase_price_cents: z.number().int().nonnegative().max(100_000_000).nullable(),
    date_source: z.enum(["manual_confirmed", "gs1_confirmed"]).nullable(),
    personal_risk_confirmed: z.boolean()
  }).superRefine((value, context) => {
    if (value.best_before_date && value.use_by_date) {
      context.addIssue({ code: "custom", message: "MHD und Verbrauchsdatum d\u00fcrfen nicht gleichzeitig gesetzt sein." });
    }
    const hasDate = Boolean(value.best_before_date || value.use_by_date);
    if (hasDate !== Boolean(value.date_source)) {
      context.addIssue({ code: "custom", path: ["date_source"], message: "Eine Datumsquelle ist genau f\u00fcr ein best\u00e4tigtes Datum erforderlich." });
    }
  })
});

export const purchaseCaptureItemsSchema = z.array(purchaseCaptureItemSchema).min(1).max(100);

export const purchaseCaptureResultSchema = z.object({
  item_count: z.number().int().min(1).max(100),
  batch_ids: z.array(z.uuid()).max(100),
  product_ids: z.array(z.uuid()).max(100),
  idempotent_replay: z.boolean()
}).strict().superRefine((value, context) => {
  if (value.batch_ids.length !== value.item_count) {
    context.addIssue({ code: "custom", path: ["batch_ids"], message: "Die Anzahl der Chargen muss item_count entsprechen." });
  }
  if (value.product_ids.length !== value.item_count) {
    context.addIssue({ code: "custom", path: ["product_ids"], message: "Die Anzahl der Produkte muss item_count entsprechen." });
  }
  if (new Set(value.batch_ids).size !== value.batch_ids.length) {
    context.addIssue({ code: "custom", path: ["batch_ids"], message: "Chargen-IDs müssen eindeutig sein." });
  }
});

export type PurchaseCaptureItem = z.infer<typeof purchaseCaptureItemSchema>;
