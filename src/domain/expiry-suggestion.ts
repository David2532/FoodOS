import type { Product } from "@/lib/types";

export type ExpirySuggestionLocation = "fridge" | "freezer" | "pantry" | "drinks" | "other";

export interface BestBeforeSuggestion {
  kind: "best_before_proposal";
  date: string;
  baseDate: string;
  dayOffset: 7;
  ruleId: "refrigerated-yogurt-v1";
  source: "category_heuristic";
  matchedCategory: string;
}

interface BestBeforeSuggestionInput {
  product: Pick<Product, "categories" | "source"> | null;
  location: ExpirySuggestionLocation | null;
  baseDate: string;
  existingBestBeforeDate?: string | null;
  existingUseByDate?: string | null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YOGURT_CATEGORIES = new Set([
  "fruit yogurt",
  "fruit yogurts",
  "fruchtjoghurt",
  "fruchtjoghurts",
  "joghurt",
  "joghurts",
  "naturjoghurt",
  "naturjoghurts",
  "plain yogurt",
  "plain yogurts",
  "plant based yogurt",
  "plant based yogurts",
  "skyr",
  "yoghurt",
  "yoghurts",
  "yogurt",
  "yogurts"
]);

function normalizeCategory(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("-", " ")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ");
}

export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export function addCalendarDays(value: string, days: number): string | null {
  if (!isCalendarDate(value) || !Number.isInteger(days)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day! + days, 12));
  return candidate.toISOString().slice(0, 10);
}

export function calendarDateInTimeZone(value = new Date(), timeZone = "Europe/Berlin"): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function suggestBestBeforeDate(input: BestBeforeSuggestionInput): BestBeforeSuggestion | null {
  if (!input.product
    || input.product.source === "manual"
    || input.location !== "fridge"
    || input.existingBestBeforeDate
    || input.existingUseByDate
    || !isCalendarDate(input.baseDate)) {
    return null;
  }

  const matchedCategory = input.product.categories.find((category) => YOGURT_CATEGORIES.has(normalizeCategory(category)));
  if (!matchedCategory) return null;
  const date = addCalendarDays(input.baseDate, 7);
  if (!date) return null;

  return {
    kind: "best_before_proposal",
    date,
    baseDate: input.baseDate,
    dayOffset: 7,
    ruleId: "refrigerated-yogurt-v1",
    source: "category_heuristic",
    matchedCategory
  };
}
