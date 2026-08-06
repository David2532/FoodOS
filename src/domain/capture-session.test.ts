import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import {
  addKnownCapture,
  addUnresolvedCapture,
  advanceCameraScanGate,
  captureExceptions,
  captureIsReady,
  captureNeedsReviewCard,
  CAPTURE_LIMIT_MESSAGE,
  captureUnitCount,
  confirmCaptureException,
  resolveCaptureIdentity,
  updateCaptureGs1,
  updateCaptureLocation,
  updateCaptureQuantity,
  type CameraScanGate,
  type CaptureEntry
} from "./capture-session";

const product: Product = {
  barcode: "3017624010701",
  name: "Testprodukt",
  categories: [], countries: [], structuredIngredients: [], allergens: [], traces: [], additives: [], labels: [],
  nutrition: {}, assessments: [], source: "cache", retrievedAt: "2026-08-06T10:00:00.000Z", confidence: .98
};

describe("continuous capture session", () => {
  it("aggregates the same GTIN and GS1 batch signature but separates different lots", () => {
    let entries = addKnownCapture([], product, { gtin: product.barcode, lotNumber: "A" }, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = addKnownCapture(entries, product, { gtin: product.barcode, lotNumber: "A" }, "22222222-2222-4222-8222-222222222222", "pantry");
    entries = addKnownCapture(entries, product, { gtin: product.barcode, lotNumber: "B" }, "33333333-3333-4333-8333-333333333333", "pantry");
    expect(entries).toHaveLength(2);
    expect(entries[0]?.quantity).toBe(2);
    expect(captureUnitCount(entries)).toBe(3);
  });

  it("keeps an unavailable lookup as a non-blocking unresolved exception", () => {
    const entries = addUnresolvedCapture([], product.barcode, null, "unavailable", "11111111-1111-4111-8111-111111111111", "pantry");
    expect(captureExceptions(entries[0]!)).toEqual(["identity"]);
    expect(captureIsReady(entries)).toBe(false);
  });

  it("upgrades an unresolved row when a later lookup succeeds", () => {
    let entries = addUnresolvedCapture([], product.barcode, null, "unavailable", "11111111-1111-4111-8111-111111111111", "pantry");
    entries = addKnownCapture(entries, product, null, "22222222-2222-4222-8222-222222222222", "pantry");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ product, quantity: 2 });
    expect(entries[0]).not.toHaveProperty("unresolvedReason");
    expect(captureIsReady(entries)).toBe(true);
  });

  it("requires explicit GS1 and personal-risk confirmation", () => {
    const risky = { ...product, assessments: [{ name: "Nuss", level: "avoid" as const, reason: "Profil", confidence: 1 }] };
    let entries = addKnownCapture([], risky, { gtin: product.barcode, useByDate: "2026-08-30" }, "11111111-1111-4111-8111-111111111111", "pantry");
    expect(captureExceptions(entries[0]!)).toEqual(["gs1", "personal-risk"]);
    entries = confirmCaptureException(entries, entries[0]!.itemMutationId, "gs1");
    entries = confirmCaptureException(entries, entries[0]!.itemMutationId, "personal-risk");
    expect(captureIsReady(entries)).toBe(true);
  });

  it("can explicitly retain a completely unknown identity without inventing facts", () => {
    let entries = addUnresolvedCapture([], product.barcode, null, "not-found", "11111111-1111-4111-8111-111111111111", "pantry");
    entries = resolveCaptureIdentity(entries, entries[0]!.itemMutationId, { ...product, name: "Unbekanntes Produkt", source: "manual", confidence: 0 });
    entries = confirmCaptureException(entries, entries[0]!.itemMutationId, "low-confidence");
    expect(entries[0]?.product).toMatchObject({ name: "Unbekanntes Produkt", confidence: 0, nutrition: {} });
    expect(entries[0]?.product).not.toHaveProperty("ingredientsText");
    expect(captureIsReady(entries)).toBe(true);
  });

  it("updates quantities reversibly", () => {
    const entries = addKnownCapture([], product, null, "11111111-1111-4111-8111-111111111111", "pantry");
    expect(updateCaptureQuantity(entries, entries[0]!.itemMutationId, 4)[0]?.quantity).toBe(4);
    expect(updateCaptureQuantity(entries, entries[0]!.itemMutationId, 0)).toEqual([]);
  });

  it("recomputes edited GS1 signatures and merges an existing compatible batch", () => {
    let entries = addKnownCapture([], product, { gtin: product.barcode, lotNumber: "A" }, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = addKnownCapture(entries, product, { gtin: product.barcode, lotNumber: "B" }, "22222222-2222-4222-8222-222222222222", "pantry");
    entries = updateCaptureGs1(entries, entries[1]!.itemMutationId, { gtin: product.barcode, lotNumber: "A" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      quantity: 2,
      signature: JSON.stringify([product.barcode, "pantry", null, null, "A", null])
    });
  });

  it("keeps GS1 field boundaries unambiguous when lot or serial contains a separator", () => {
    let entries = addKnownCapture([], product, { gtin: product.barcode, lotNumber: "A|B" }, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = addKnownCapture(entries, product, { gtin: product.barcode, lotNumber: "A", serialNumber: "B" }, "22222222-2222-4222-8222-222222222222", "pantry");
    expect(entries).toHaveLength(2);
  });

  it("marks only an actual date correction as manual and normalizes cleared GS1 values", () => {
    const originalGs1 = { gtin: product.barcode, bestBeforeDate: "2027-06-30", lotNumber: "LOT-42", serialNumber: "SERIAL-7" };
    let entries = addKnownCapture([], product, originalGs1, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = updateCaptureGs1(entries, entries[0]!.itemMutationId, { ...originalGs1, lotNumber: " ", serialNumber: "" });
    expect(entries[0]).toMatchObject({ gs1DateEdited: false, gs1: { bestBeforeDate: "2027-06-30" } });
    expect(entries[0]?.gs1).not.toHaveProperty("lotNumber", "LOT-42");
    expect(entries[0]?.gs1?.lotNumber).toBeUndefined();
    expect(entries[0]?.gs1?.serialNumber).toBeUndefined();

    entries = updateCaptureGs1(entries, entries[0]!.itemMutationId, { ...entries[0]!.gs1!, bestBeforeDate: "2027-07-01" });
    expect(entries[0]?.gs1DateEdited).toBe(true);
    entries = updateCaptureGs1(entries, entries[0]!.itemMutationId, { ...entries[0]!.gs1!, bestBeforeDate: "2027-06-30" });
    expect(entries[0]?.gs1DateEdited).toBe(false);
    entries = updateCaptureGs1(entries, entries[0]!.itemMutationId, { ...entries[0]!.gs1!, bestBeforeDate: "" });
    expect(entries[0]?.gs1?.bestBeforeDate).toBeUndefined();
    expect(entries[0]?.gs1DateEdited).toBe(true);
  });

  it("preserves a known identity when an edited unresolved GS1 row collides", () => {
    let entries = addKnownCapture([], product, { gtin: product.barcode, lotNumber: "A" }, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = addUnresolvedCapture(entries, product.barcode, { gtin: product.barcode, lotNumber: "B" }, "unavailable", "22222222-2222-4222-8222-222222222222", "pantry");
    entries = updateCaptureGs1(entries, entries[1]!.itemMutationId, { gtin: product.barcode, lotNumber: "A" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ product, quantity: 2 });
    expect(entries[0]).not.toHaveProperty("unresolvedReason");
  });

  it("does not re-count a held camera barcode until it has left the frame", () => {
    let gate: CameraScanGate = { armedCode: null, absentSince: null };
    let decision = advanceCameraScanGate(gate, product.barcode, 0);
    expect(decision.accept).toBe(true);
    gate = decision.gate;
    decision = advanceCameraScanGate(gate, product.barcode, 5_000);
    expect(decision.accept).toBe(false);
    decision = advanceCameraScanGate(decision.gate, "4006381333931", 5_010);
    expect(decision.accept).toBe(true);
    gate = advanceCameraScanGate(decision.gate, null, 6_000).gate;
    gate = advanceCameraScanGate(gate, null, 6_350).gate;
    expect(advanceCameraScanGate(gate, "4006381333931", 6_351).accept).toBe(true);
  });

  it("does not arm a different barcode while the previous lookup is still in flight", () => {
    const first = advanceCameraScanGate({ armedCode: null, absentSince: null }, product.barcode, 0);
    const blocked = advanceCameraScanGate(first.gate, "4006381333931", 10, 350, false);
    expect(blocked).toEqual({ gate: first.gate, accept: false });
    expect(advanceCameraScanGate(blocked.gate, "4006381333931", 20, 350, true).accept).toBe(true);
  });

  it("allows a safety confirmation to be revoked", () => {
    const risky = { ...product, assessments: [{ name: "Nuss", level: "avoid" as const, reason: "Profil", confidence: 1 }] };
    let entries = addKnownCapture([], risky, null, "11111111-1111-4111-8111-111111111111", "pantry");
    entries = confirmCaptureException(entries, entries[0]!.itemMutationId, "personal-risk", true);
    expect(captureIsReady(entries)).toBe(true);
    entries = confirmCaptureException(entries, entries[0]!.itemMutationId, "personal-risk", false);
    expect(captureIsReady(entries)).toBe(false);
  });

  it("reopens safety review when a repeated payload introduces risk or uncertainty", () => {
    const risky = { ...product, assessments: [{ name: "Nuss", level: "avoid" as const, reason: "Profil", confidence: 1 }] };
    let riskEntries = addKnownCapture([], product, null, "11111111-1111-4111-8111-111111111111", "pantry");
    riskEntries = addKnownCapture(riskEntries, risky, null, "22222222-2222-4222-8222-222222222222", "pantry");
    expect(riskEntries[0]?.confirmations.personalRisk).toBe(false);

    let degradedEntries = addKnownCapture([], product, null, "33333333-3333-4333-8333-333333333333", "pantry");
    degradedEntries = addKnownCapture(degradedEntries, product, null, "44444444-4444-4444-8444-444444444444", "pantry", true);
    expect(degradedEntries[0]?.confirmations.lowConfidence).toBe(false);

    let uncertainEntries = addKnownCapture([], product, null, "55555555-5555-4555-8555-555555555555", "pantry");
    uncertainEntries = addKnownCapture(uncertainEntries, { ...product, confidence: 0.4 }, null, "66666666-6666-4666-8666-666666666666", "pantry");
    expect(uncertainEntries[0]?.confirmations.lowConfidence).toBe(false);
  });

  it("keeps an unknown location unresolved and editable without losing the review card", () => {
    let entries = addKnownCapture([], product, null, "11111111-1111-4111-8111-111111111111", null);
    expect(captureExceptions(entries[0]!)).toEqual(["location"]);
    entries = updateCaptureLocation(entries, entries[0]!.itemMutationId, "fridge");
    expect(captureIsReady(entries)).toBe(true);
    expect(captureNeedsReviewCard(entries[0]!)).toBe(true);
    entries = updateCaptureLocation(entries, entries[0]!.itemMutationId, null);
    expect(captureIsReady(entries)).toBe(false);
  });

  it("caps distinct rows at 100 while identical scans can still increase quantity", () => {
    expect(CAPTURE_LIMIT_MESSAGE).toContain("100 unterschiedliche Positionen");
    let entries = Array.from({ length: 100 }).reduce<CaptureEntry[]>((current, _, index) => addUnresolvedCapture(
      current,
      `code-${index}`,
      null,
      "not-found",
      `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      "pantry"
    ), []);
    expect(entries).toHaveLength(100);
    entries = addUnresolvedCapture(entries, "code-0", null, "not-found", "22222222-2222-4222-8222-222222222222", "pantry");
    expect(entries).toHaveLength(100);
    expect(entries[0]?.quantity).toBe(2);
    entries = addUnresolvedCapture(entries, "code-overflow", null, "not-found", "33333333-3333-4333-8333-333333333333", "pantry");
    expect(entries).toHaveLength(100);
  });
});
