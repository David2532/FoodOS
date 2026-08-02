export type ExpiryKind = "best_before" | "use_by";
export type ExpiryState = "future" | "soon" | "today" | "past_best_before" | "past_use_by" | "unknown";

const dayMs = 86_400_000;

function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : null;
}

export function classifyExpiry(kind: ExpiryKind, date: string | null | undefined, today: string): { state: ExpiryState; days: number | null } {
  if (!date) return { state: "unknown", days: null };
  const expiry = utcDay(date);
  const reference = utcDay(today);
  if (expiry == null || reference == null) return { state: "unknown", days: null };
  const days = Math.round((expiry - reference) / dayMs);
  if (days < 0) return { state: kind === "use_by" ? "past_use_by" : "past_best_before", days };
  if (days === 0) return { state: "today", days };
  if (days <= 7) return { state: "soon", days };
  return { state: "future", days };
}

export function isConsumableSuggestionAllowed(kind: ExpiryKind, date: string | null | undefined, today: string): boolean {
  return classifyExpiry(kind, date, today).state !== "past_use_by";
}
