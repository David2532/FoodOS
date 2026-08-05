import type { NutritionSummaryRow } from "@/contracts/nutrition-summary";

export type NutritionMetricStatus = "empty" | "known" | "partial" | "unknown";

export interface NutritionMetricSummary {
  value: number | null;
  knownEntries: number;
  totalEntries: number;
  status: NutritionMetricStatus;
}

export interface NutritionTotals {
  entryCount: number;
  kcal: NutritionMetricSummary;
  proteinG: NutritionMetricSummary;
  carbsG: NutritionMetricSummary;
  fatG: NutritionMetricSummary;
}

export interface NutritionDaySummary extends NutritionTotals {
  date: string;
}

export interface NutritionWeekSummary {
  startDate: string;
  endDate: string;
  days: NutritionDaySummary[];
  totals: NutritionTotals;
}

function plusDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid nutrition summary date");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function metricSummary(
  value: number | null,
  knownEntries: number,
  totalEntries: number,
  label: string
): NutritionMetricSummary {
  if (!Number.isInteger(knownEntries) || !Number.isInteger(totalEntries)
    || knownEntries < 0 || totalEntries < 0 || knownEntries > totalEntries) {
    throw new TypeError(`Invalid ${label} coverage`);
  }
  if ((knownEntries === 0 && value !== null) || (knownEntries > 0 && value === null)) {
    throw new TypeError(`Inconsistent ${label} value`);
  }
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new TypeError(`Invalid ${label} value`);
  }

  const status: NutritionMetricStatus = totalEntries === 0
    ? "empty"
    : knownEntries === 0
      ? "unknown"
      : knownEntries < totalEntries
        ? "partial"
        : "known";
  return { value, knownEntries, totalEntries, status };
}

function mapDay(row: NutritionSummaryRow): NutritionDaySummary {
  return {
    date: row.summary_date,
    entryCount: row.entry_count,
    kcal: metricSummary(row.kcal, row.kcal_known_count, row.entry_count, "kcal"),
    proteinG: metricSummary(row.protein_g, row.protein_known_count, row.entry_count, "protein"),
    carbsG: metricSummary(row.carbohydrates_g, row.carbohydrates_known_count, row.entry_count, "carbohydrates"),
    fatG: metricSummary(row.fat_g, row.fat_known_count, row.entry_count, "fat")
  };
}

function aggregateMetric(days: NutritionDaySummary[], key: "kcal" | "proteinG" | "carbsG" | "fatG") {
  const knownEntries = days.reduce((sum, day) => sum + day[key].knownEntries, 0);
  const totalEntries = days.reduce((sum, day) => sum + day.entryCount, 0);
  const value = knownEntries === 0
    ? null
    : days.reduce((sum, day) => sum + (day[key].value ?? 0), 0);
  return metricSummary(value, knownEntries, totalEntries, key);
}

export function buildNutritionSummary(
  rows: readonly NutritionSummaryRow[],
  today: string
): { today: NutritionDaySummary; week: NutritionWeekSummary } {
  if (rows.length !== 7) throw new TypeError("Nutrition summary must contain seven days");
  const startDate = rows[0]?.summary_date;
  if (!startDate) throw new TypeError("Nutrition summary has no start date");
  rows.forEach((row, index) => {
    if (row.summary_date !== plusDays(startDate, index)) {
      throw new TypeError("Nutrition summary dates must be consecutive");
    }
  });

  const days = rows.map(mapDay);
  const todaySummary = days.find((day) => day.date === today);
  if (!todaySummary) throw new TypeError("Today is outside the nutrition summary week");
  const entryCount = days.reduce((sum, day) => sum + day.entryCount, 0);

  return {
    today: todaySummary,
    week: {
      startDate,
      endDate: plusDays(startDate, 6),
      days,
      totals: {
        entryCount,
        kcal: aggregateMetric(days, "kcal"),
        proteinG: aggregateMetric(days, "proteinG"),
        carbsG: aggregateMetric(days, "carbsG"),
        fatG: aggregateMetric(days, "fatG")
      }
    }
  };
}
