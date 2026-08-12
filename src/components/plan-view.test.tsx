/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSnapshot, InventoryItem, MealPlanItem } from "@/lib/types";

const doubles = vi.hoisted(() => ({
  rpc: vi.fn(),
  submitDurableRpc: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ rpc: doubles.rpc })
}));
vi.mock("@/infrastructure/offline-outbox", () => ({
  submitDurableRpc: doubles.submitDurableRpc
}));

import { PlanView } from "./plan-view";

const metric = { value: null, knownEntries: 0, totalEntries: 0, status: "empty" as const };
const householdId = "00000000-0000-4000-8000-000000000001";
const stockedProductId = "00000000-0000-4000-8000-000000000002";
const removedProductId = "00000000-0000-4000-8000-000000000003";

function inventory(productId = stockedProductId): InventoryItem {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    productId,
    name: "Haferflocken",
    remainingLabel: "300 g",
    remainingAmount: 300,
    unit: "g",
    location: "Vorrat",
    expiryState: "unknown",
    personalRiskMatches: [],
    recall: { kind: "none", blocksConsumption: false, stale: false, wording: "Kein Rückruf" },
    nutrition: {}
  };
}

function planItem(overrides: Partial<MealPlanItem> = {}): MealPlanItem {
  return {
    id: "00000000-0000-4000-8000-000000000005",
    productId: stockedProductId,
    plannedFor: "2026-08-03",
    mealType: "breakfast",
    servings: 1,
    plannedAmount: 500,
    plannedUnit: "g",
    revision: 1,
    productName: "Haferflocken",
    ...overrides
  };
}

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    currentUserId: "00000000-0000-4000-8000-000000000009",
    household: { id: householdId, name: "Testhaushalt" },
    households: [{ household_id: householdId, household_name: "Testhaushalt", member_role: "owner", membership_revision: 1, member_count: 1, member_limit: 1 }],
    householdMembers: [],
    pendingHouseholdInvitations: [],
    inventory: [inventory()],
    today: { date: "2026-08-05", entryCount: 0, kcal: metric, proteinG: metric, carbsG: metric, fatG: metric },
    nutritionWeek: {
      startDate: "2026-08-03",
      endDate: "2026-08-09",
      days: [],
      totals: { entryCount: 0, kcal: metric, proteinG: metric, carbsG: metric, fatG: metric }
    },
    weekStart: "2026-08-03",
  mealPlan: [planItem()],
  mealSuggestions: [],
  mealSuggestionRecipeCount: 0,
    shoppingItems: [],
    shoppingCalculationRevision: 0,
    recallSource: { status: "fresh" },
    ...overrides
  };
}

describe("PlanView", () => {
  beforeEach(() => {
    doubles.rpc.mockReset();
    doubles.submitDurableRpc.mockReset();
    doubles.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { id: "00000000-0000-4000-8000-000000000006", revision: 1, idempotent_replay: false }
    });
  });

  afterEach(() => cleanup());

  it("resets the selected day when the loaded week changes", async () => {
    const view = render(<PlanView snapshot={snapshot()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /di/i })[0]!);
    expect(screen.queryByText("Haferflocken")).toBeNull();

    view.rerender(<PlanView snapshot={snapshot({
      weekStart: "2026-08-10",
      mealPlan: [planItem({ plannedFor: "2026-08-10", productName: "Wochenwechsel-Produkt" })],
      nutritionWeek: { ...snapshot().nutritionWeek, startDate: "2026-08-10", endDate: "2026-08-16" }
    })} onChanged={vi.fn()} />);

    expect(await screen.findByText("Wochenwechsel-Produkt")).toBeTruthy();
  });

  it("keeps the edited product visible after it has left inventory", () => {
    render(<PlanView snapshot={snapshot({
      mealPlan: [planItem({ productId: removedProductId, productName: "Aufgebrauchtes Produkt" })]
    })} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Aufgebrauchtes Produkt bearbeiten" }));
    const select = screen.getByLabelText("Produkt aus dem Vorrat") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe(removedProductId);
    expect(screen.getByRole("option", { name: "Aufgebrauchtes Produkt (nicht mehr im Vorrat)" })).toBeTruthy();
  });

  it("submits an explicit quantity and unit through the revision-safe RPC", async () => {
    const onChanged = vi.fn();
    render(<PlanView snapshot={snapshot({ mealPlan: [] })} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /planen/i }));
    fireEvent.change(screen.getByLabelText("Planmenge"), { target: { value: "750" } });
    fireEvent.change(screen.getByLabelText("Einheit"), { target: { value: "g" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintrag erstellen" }));

    await waitFor(() => expect(doubles.submitDurableRpc).toHaveBeenCalledOnce());
    expect(doubles.submitDurableRpc).toHaveBeenCalledWith(expect.objectContaining({
      kind: "plan.add_product_v2",
      rpc: "plan_product_v2",
      args: expect.objectContaining({ target_amount: 750, target_unit: "g" })
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  });

  it("keeps the plan item and reports an honest error when delete is offline", async () => {
    const onChanged = vi.fn();
    doubles.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<PlanView snapshot={snapshot()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "Haferflocken löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));

    expect((await screen.findByRole("alert")).textContent).toContain("ohne Serververbindung");
    expect(screen.getByText("Haferflocken aus dem Plan löschen?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Löschen" }).hasAttribute("disabled")).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
