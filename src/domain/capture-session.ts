import type { Gs1Elements } from "./gs1";
import type { Product } from "@/lib/types";
import { isCalendarDate } from "./expiry-suggestion";

export type CaptureUnresolvedReason = "not-found" | "unavailable";
export type CaptureLocation = "fridge" | "freezer" | "pantry" | "drinks" | "other";
export type CaptureExceptionKind = "identity" | "location" | "gs1" | "personal-risk" | "low-confidence";
export const MAX_CAPTURE_ENTRIES = 100;
export const CAPTURE_LIMIT_MESSAGE = "Dieser Einkauf enthält bereits 100 unterschiedliche Positionen. Übernimm ihn zuerst; identische Scans erhöhen weiterhin die Menge.";

export interface CaptureEntry {
  itemMutationId: string;
  signature: string;
  barcode: string;
  product: Product | null;
  gs1: Gs1Elements | null;
  location: CaptureLocation | null;
  quantity: number;
  unresolvedReason?: CaptureUnresolvedReason;
  sourceNeedsReview?: boolean;
  gs1DateEdited?: boolean;
  gs1OriginalBestBeforeDate?: string;
  gs1OriginalUseByDate?: string;
  locationNeedsReview?: boolean;
  confirmations: {
    identity: boolean;
    gs1: boolean;
    personalRisk: boolean;
    lowConfidence: boolean;
  };
}

export interface CameraScanGate {
  armedCode: string | null;
  absentSince: number | null;
}

export function captureSignature(barcode: string, gs1: Gs1Elements | null, location: CaptureLocation | null): string {
  // JSON encoding keeps every field boundary unambiguous even when a GS1 lot or
  // serial contains characters such as `|`. The signature is local-only and is
  // never used as a server identity or displayed to the user.
  return JSON.stringify([
    barcode,
    location,
    gs1?.bestBeforeDate ?? null,
    gs1?.useByDate ?? null,
    gs1?.lotNumber ?? null,
    gs1?.serialNumber ?? null
  ]);
}

function normalizedOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeGs1Elements(gs1: Gs1Elements): Gs1Elements {
  return {
    ...gs1,
    bestBeforeDate: normalizedOptional(gs1.bestBeforeDate),
    useByDate: normalizedOptional(gs1.useByDate),
    lotNumber: normalizedOptional(gs1.lotNumber),
    serialNumber: normalizedOptional(gs1.serialNumber)
  };
}

export function addKnownCapture(
  entries: CaptureEntry[],
  product: Product,
  gs1: Gs1Elements | null,
  itemMutationId: string,
  location: CaptureLocation | null = null,
  sourceNeedsReview = false
): CaptureEntry[] {
  const signature = captureSignature(product.barcode, gs1, location);
  const existing = entries.find((entry) => entry.signature === signature);
  if (existing) {
    return entries.map((entry) => {
      if (entry !== existing) return entry;
      const previousRisk = Boolean(entry.product && hasPersonalRisk(entry.product));
      const nextRisk = hasPersonalRisk(product);
      const previousUncertainty = Boolean(entry.product && (hasLowConfidence(entry.product) || entry.sourceNeedsReview));
      const nextUncertainty = hasLowConfidence(product) || sourceNeedsReview;
      const upgraded: CaptureEntry = {
        ...entry,
        product,
        sourceNeedsReview,
        quantity: Math.min(999, entry.quantity + 1),
        confirmations: {
          identity: true,
          gs1: entry.product ? entry.confirmations.gs1 : !hasGs1BatchFacts(gs1),
          personalRisk: nextRisk ? (previousRisk && entry.confirmations.personalRisk) : true,
          lowConfidence: nextUncertainty ? (previousUncertainty && entry.confirmations.lowConfidence) : true
        }
      };
      delete upgraded.unresolvedReason;
      return upgraded;
    });
  }
  if (entries.length >= MAX_CAPTURE_ENTRIES) return entries;
  return [...entries, {
    itemMutationId,
    signature,
    barcode: product.barcode,
    product,
    gs1,
    location,
    quantity: 1,
    sourceNeedsReview,
    gs1DateEdited: false,
    gs1OriginalBestBeforeDate: normalizedOptional(gs1?.bestBeforeDate),
    gs1OriginalUseByDate: normalizedOptional(gs1?.useByDate),
    locationNeedsReview: location === null,
    confirmations: {
      identity: true,
      gs1: !hasGs1BatchFacts(gs1),
      personalRisk: !hasPersonalRisk(product),
      lowConfidence: !(hasLowConfidence(product) || sourceNeedsReview)
    }
  }];
}

export function addUnresolvedCapture(
  entries: CaptureEntry[],
  barcode: string,
  gs1: Gs1Elements | null,
  reason: CaptureUnresolvedReason,
  itemMutationId: string,
  location: CaptureLocation | null = null
): CaptureEntry[] {
  const signature = captureSignature(barcode, gs1, location);
  const existing = entries.find((entry) => entry.signature === signature);
  if (existing) {
    return entries.map((entry) => entry === existing ? { ...entry, quantity: Math.min(999, entry.quantity + 1) } : entry);
  }
  if (entries.length >= MAX_CAPTURE_ENTRIES) return entries;
  return [...entries, {
    itemMutationId,
    signature,
    barcode,
    product: null,
    gs1,
    location,
    quantity: 1,
    unresolvedReason: reason,
    locationNeedsReview: location === null,
    gs1DateEdited: false,
    gs1OriginalBestBeforeDate: normalizedOptional(gs1?.bestBeforeDate),
    gs1OriginalUseByDate: normalizedOptional(gs1?.useByDate),
    confirmations: { identity: false, gs1: !hasGs1BatchFacts(gs1), personalRisk: true, lowConfidence: true }
  }];
}

export function updateCaptureQuantity(entries: CaptureEntry[], itemMutationId: string, quantity: number): CaptureEntry[] {
  if (quantity <= 0) return entries.filter((entry) => entry.itemMutationId !== itemMutationId);
  return entries.map((entry) => entry.itemMutationId === itemMutationId
    ? { ...entry, quantity: Math.min(999, Math.floor(quantity)) }
    : entry);
}

export function removeCapture(entries: CaptureEntry[], itemMutationId: string): CaptureEntry[] {
  return entries.filter((entry) => entry.itemMutationId !== itemMutationId);
}

export function updateCaptureGs1(entries: CaptureEntry[], itemMutationId: string, gs1: Gs1Elements): CaptureEntry[] {
  const target = entries.find((entry) => entry.itemMutationId === itemMutationId);
  if (!target) return entries;
  const normalizedGs1 = normalizeGs1Elements(gs1);
  const signature = captureSignature(target.barcode, normalizedGs1, target.location);
  const collision = entries.find((entry) => entry.itemMutationId !== itemMutationId && entry.signature === signature);
  const identitySource = target.product ? target : collision?.product ? collision : target;
  const gs1DateEdited = normalizedOptional(normalizedGs1.bestBeforeDate) !== target.gs1OriginalBestBeforeDate
    || normalizedOptional(normalizedGs1.useByDate) !== target.gs1OriginalUseByDate;
  const updated: CaptureEntry = {
    ...identitySource,
    itemMutationId: target.itemMutationId,
    signature,
    barcode: target.barcode,
    gs1: normalizedGs1,
    gs1DateEdited,
    gs1OriginalBestBeforeDate: target.gs1OriginalBestBeforeDate,
    gs1OriginalUseByDate: target.gs1OriginalUseByDate,
    quantity: Math.min(999, target.quantity + (collision?.quantity ?? 0)),
    confirmations: { ...identitySource.confirmations, gs1: false }
  };
  return entries
    .filter((entry) => entry.itemMutationId !== collision?.itemMutationId)
    .map((entry) => entry.itemMutationId === itemMutationId ? updated : entry);
}

export function confirmSuggestedBestBefore(
  entries: CaptureEntry[],
  itemMutationId: string,
  date: string,
  remainderItemMutationId?: string
): CaptureEntry[] {
  const target = entries.find((entry) => entry.itemMutationId === itemMutationId);
  if (!target
    || !isCalendarDate(date)
    || target.gs1?.bestBeforeDate
    || target.gs1?.useByDate
    || target.gs1OriginalBestBeforeDate
    || target.gs1OriginalUseByDate) return entries;

  if (target.quantity > 1 && (
    !remainderItemMutationId
    || entries.length >= MAX_CAPTURE_ENTRIES
    || entries.some((entry) => entry.itemMutationId === remainderItemMutationId)
  )) return entries;

  const gs1 = normalizeGs1Elements({
    ...(target.gs1 ?? { gtin: target.barcode }),
    bestBeforeDate: date,
    useByDate: undefined
  });
  const hasOtherPackageFacts = Boolean(gs1.lotNumber || gs1.serialNumber);
  const confirmedTarget: CaptureEntry = {
    ...target,
    signature: captureSignature(target.barcode, gs1, target.location),
    gs1,
    quantity: 1,
    gs1DateEdited: true,
    confirmations: {
      ...target.confirmations,
      gs1: hasOtherPackageFacts ? target.confirmations.gs1 : true
    }
  };

  return entries.flatMap((entry) => {
    if (entry !== target) return [entry];
    if (target.quantity === 1) return [confirmedTarget];
    return [confirmedTarget, {
      ...target,
      itemMutationId: remainderItemMutationId!,
      quantity: target.quantity - 1
    }];
  });
}

export function updateCaptureLocation(entries: CaptureEntry[], itemMutationId: string, location: CaptureLocation | null): CaptureEntry[] {
  const target = entries.find((entry) => entry.itemMutationId === itemMutationId);
  if (!target) return entries;
  const signature = captureSignature(target.barcode, target.gs1, location);
  const collision = entries.find((entry) => entry.itemMutationId !== itemMutationId && entry.signature === signature);
  const identitySource = target.product ? target : collision?.product ? collision : target;
  const updated: CaptureEntry = {
    ...identitySource,
    itemMutationId: target.itemMutationId,
    signature,
    barcode: target.barcode,
    gs1: target.gs1,
    location,
    locationNeedsReview: Boolean(target.locationNeedsReview || location === null),
    gs1DateEdited: Boolean(target.gs1DateEdited || collision?.gs1DateEdited),
    quantity: Math.min(999, target.quantity + (collision?.quantity ?? 0))
  };
  return entries
    .filter((entry) => entry.itemMutationId !== collision?.itemMutationId)
    .map((entry) => entry.itemMutationId === itemMutationId ? updated : entry);
}

export function resolveCaptureIdentity(entries: CaptureEntry[], itemMutationId: string, product: Product): CaptureEntry[] {
  return entries.map((entry) => {
    if (entry.itemMutationId !== itemMutationId) return entry;
    const resolved: CaptureEntry = {
        ...entry,
        product,
        confirmations: {
          ...entry.confirmations,
          identity: true,
          personalRisk: !hasPersonalRisk(product),
          lowConfidence: !hasLowConfidence(product)
        }
      };
    delete resolved.unresolvedReason;
    return resolved;
  });
}

export function confirmCaptureException(
  entries: CaptureEntry[],
  itemMutationId: string,
  exception: Exclude<CaptureExceptionKind, "identity" | "location">,
  confirmed = true
): CaptureEntry[] {
  return entries.map((entry) => entry.itemMutationId === itemMutationId
    ? { ...entry, confirmations: { ...entry.confirmations, [exceptionKey(exception)]: confirmed } }
    : entry);
}

export function advanceCameraScanGate(
  gate: CameraScanGate,
  code: string | null,
  now: number,
  releaseAfterMs = 350,
  canAcceptNewCode = true
): { gate: CameraScanGate; accept: boolean } {
  if (code) {
    if (gate.armedCode === code) return { gate: { armedCode: gate.armedCode, absentSince: null }, accept: false };
    if (!canAcceptNewCode) return { gate, accept: false };
    return { gate: { armedCode: code, absentSince: null }, accept: true };
  }
  if (!gate.armedCode) return { gate: { armedCode: null, absentSince: null }, accept: false };
  if (gate.absentSince === null) return { gate: { ...gate, absentSince: now }, accept: false };
  if (now - gate.absentSince < releaseAfterMs) return { gate, accept: false };
  return { gate: { armedCode: null, absentSince: null }, accept: false };
}

export function captureExceptions(entry: CaptureEntry): CaptureExceptionKind[] {
  const exceptions: CaptureExceptionKind[] = [];
  if (!entry.product || !entry.confirmations.identity) exceptions.push("identity");
  if (!entry.location) exceptions.push("location");
  if (hasGs1BatchFacts(entry.gs1) && !entry.confirmations.gs1) exceptions.push("gs1");
  if (entry.product && hasPersonalRisk(entry.product) && !entry.confirmations.personalRisk) exceptions.push("personal-risk");
  if (entry.product && (hasLowConfidence(entry.product) || entry.sourceNeedsReview) && !entry.confirmations.lowConfidence) exceptions.push("low-confidence");
  return exceptions;
}

export function captureIsReady(entries: CaptureEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.product && captureExceptions(entry).length === 0);
}

export function captureNeedsReviewCard(entry: CaptureEntry): boolean {
  return !entry.product
    || !entry.confirmations.identity
    || !entry.location
    || Boolean(entry.locationNeedsReview)
    || hasGs1BatchFacts(entry.gs1)
    || Boolean(entry.product && hasPersonalRisk(entry.product))
    || Boolean(entry.product && hasLowConfidence(entry.product))
    || Boolean(entry.sourceNeedsReview);
}

export function captureUnitCount(entries: CaptureEntry[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

export function hasGs1BatchFacts(gs1: Gs1Elements | null): boolean {
  return Boolean(gs1?.bestBeforeDate || gs1?.useByDate || gs1?.lotNumber || gs1?.serialNumber);
}

export function hasPersonalRisk(product: Product): boolean {
  return product.assessments.some((assessment) => assessment.level === "avoid");
}

export function hasLowConfidence(product: Product): boolean {
  return product.confidence < 0.75;
}

function exceptionKey(exception: Exclude<CaptureExceptionKind, "identity" | "location">): "gs1" | "personalRisk" | "lowConfidence" {
  if (exception === "personal-risk") return "personalRisk";
  if (exception === "low-confidence") return "lowConfidence";
  return "gs1";
}
