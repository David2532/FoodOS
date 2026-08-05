import type { PlanningUnit } from "@/contracts/planning-shopping";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = "2000-01-03";
const MAX_MONDAY = "2100-12-27";

export function isSupportedMonday(value: string): boolean {
  if (!ISO_DATE.test(value) || value < MIN_DATE || value > MAX_MONDAY) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 1;
}

export function weekDatesFromMonday(weekStart: string): string[] {
  if (!isSupportedMonday(weekStart)) throw new Error("Week start must be a supported Monday");
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function formatPlanningAmount(amount: number, unit: PlanningUnit): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Planning amount must be positive");
  const value = amount.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  return `${value} ${unit === "piece" ? "Stück" : unit}`;
}
