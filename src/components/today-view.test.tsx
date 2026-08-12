/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSnapshot } from "@/lib/types";
import { TodayView } from "./today-view";

afterEach(() => cleanup());

const emptyMetric = { value: null, knownEntries: 0, totalEntries: 0, status: "empty" as const };
const snapshot: AppSnapshot = {
  currentUserId: "00000000-0000-4000-8000-000000000009",
  household: { id: "00000000-0000-4000-8000-000000000001", name: "Testhaushalt" },
  households: [{ household_id: "00000000-0000-4000-8000-000000000001", household_name: "Testhaushalt", member_role: "owner", membership_revision: 1, member_count: 1, member_limit: 1 }],
  householdMembers: [],
  pendingHouseholdInvitations: [],
  inventory: [],
  today: {
    date: "2026-08-05",
    entryCount: 2,
    kcal: { value: 750, knownEntries: 2, totalEntries: 2, status: "known" },
    proteinG: { value: 70, knownEntries: 2, totalEntries: 2, status: "known" },
    carbsG: { value: 30, knownEntries: 2, totalEntries: 2, status: "known" },
    fatG: { value: 5, knownEntries: 1, totalEntries: 2, status: "partial" },
    calorieTarget: 2200,
    proteinTargetG: 150
  },
  nutritionWeek: {
    startDate: "2026-08-03",
    endDate: "2026-08-09",
    days: [],
    totals: {
      entryCount: 2,
      kcal: { value: 750, knownEntries: 2, totalEntries: 2, status: "known" },
      proteinG: { value: 70, knownEntries: 2, totalEntries: 2, status: "known" },
      carbsG: { value: 30, knownEntries: 2, totalEntries: 2, status: "known" },
      fatG: { value: 5, knownEntries: 1, totalEntries: 2, status: "partial" }
    }
  },
  weekStart: "2026-08-03",
  mealPlan: [],
  mealSuggestions: [{
    recipeId: "00000000-0000-4000-8000-000000000101",
    name: "Reis mit Gemüse",
    servings: 2,
    availability: "complete",
    ingredients: [{ productId: "00000000-0000-4000-8000-000000000201", name: "Reis", requiredAmount: 200, availableAmount: 200, missingAmount: 0, unit: "g", status: "available" }],
    useSoonNames: ["Reis"],
    hasUncertainCoverage: false
  }],
  mealSuggestionRecipeCount: 1,
  shoppingItems: [],
  recallSource: { status: "fresh" }
};

describe("TodayView catalog entry", () => {
  it("offers a one-click catalog entry from the home screen", () => {
    const onNavigate = vi.fn();

    render(<TodayView onNavigate={onNavigate} />);

    expect(screen.getByRole("heading", { name: "Produkt suchen oder scannen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lebensmittelkatalog öffnen" }));
    expect(onNavigate).toHaveBeenCalledWith("scan");
  });

  it("opens a source-backed protein shake search instead of presenting a fake product", () => {
    const onOpenCatalog = vi.fn();
    render(<TodayView onNavigate={vi.fn()} onOpenCatalog={onOpenCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: /proteinshake auswählen/i }));

    expect(onOpenCatalog).toHaveBeenCalledWith("Rühls Bestes Whey");
  });

  it("shows authoritative daily and weekly nutrition with partial coverage", () => {
    render(<TodayView onNavigate={vi.fn()} snapshot={snapshot} />);

    expect(screen.getByLabelText("Kalorien heute: 750 Kilokalorien")).toBeTruthy();
    expect(screen.getByLabelText("Fett heute: 5 Gramm")).toBeTruthy();
    expect(screen.getByLabelText("Kalorien diese Woche: 750 Kilokalorien")).toBeTruthy();
    expect(screen.getAllByText("1 von 2 Buchungen ohne Angabe")).toHaveLength(2);
  });

  it("puts an explainable inventory-based meal decision before nutrition", () => {
    render(<TodayView onNavigate={vi.fn()} snapshot={snapshot} />);

    const suggestionHeading = screen.getByRole("heading", { name: "Was kann ich jetzt essen?" });
    const nutritionHeading = screen.getByRole("heading", { name: /Heute · 2 Buchungen/ });
    expect(suggestionHeading.compareDocumentPosition(nutritionHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reis mit Gemüse" })).toBeTruthy();
    fireEvent.click(screen.getByText("Zutaten prüfen"));
    expect(screen.getByText("FoodOS zieht hier noch nichts vom Vorrat ab.")).toBeTruthy();
  });

  it("offers a recovery path when recipes have no eligible suggestion", () => {
    const onNavigate = vi.fn();
    render(<TodayView onNavigate={onNavigate} snapshot={{ ...snapshot, mealSuggestions: [] }} />);

    expect(screen.getByRole("heading", { name: "Aktuell kein passender Vorschlag" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Vorrat prüfen/ }));
    expect(onNavigate).toHaveBeenCalledWith("inventory");
  });

  it("renders a missing nutrition value as unknown and never as a synthetic zero", () => {
    const unknownSnapshot: AppSnapshot = {
      ...snapshot,
      today: {
        ...snapshot.today,
        entryCount: 1,
        fatG: { value: null, knownEntries: 0, totalEntries: 1, status: "unknown" }
      },
      nutritionWeek: {
        ...snapshot.nutritionWeek,
        totals: { ...snapshot.nutritionWeek.totals, fatG: emptyMetric }
      }
    };

    render(<TodayView onNavigate={vi.fn()} snapshot={unknownSnapshot} />);

    const fat = screen.getByLabelText("Fett heute: Unbekannt");
    expect(fat.textContent).toContain("—");
    expect(fat.textContent).not.toContain("0");
    expect(screen.getByText("1 Buchung ohne Angabe")).toBeTruthy();
  });
});
