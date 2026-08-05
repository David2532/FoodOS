/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSnapshot } from "@/lib/types";

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

import { ShoppingView } from "./shopping-view";

const metric = { value: null, knownEntries: 0, totalEntries: 0, status: "empty" as const };
const snapshot: AppSnapshot = {
  currentUserId: "00000000-0000-4000-8000-000000000009",
  household: { id: "00000000-0000-4000-8000-000000000001", name: "Testhaushalt" },
  households: [{ household_id: "00000000-0000-4000-8000-000000000001", household_name: "Testhaushalt", member_role: "owner", membership_revision: 1, member_count: 1, member_limit: 1 }],
  householdMembers: [],
  pendingHouseholdInvitations: [],
  inventory: [],
  today: { date: "2026-08-05", entryCount: 0, kcal: metric, proteinG: metric, carbsG: metric, fatG: metric },
  nutritionWeek: {
    startDate: "2026-08-03",
    endDate: "2026-08-09",
    days: [],
    totals: { entryCount: 0, kcal: metric, proteinG: metric, carbsG: metric, fatG: metric }
  },
  weekStart: "2026-08-03",
  mealPlan: [],
  shoppingItems: [{
    id: "00000000-0000-4000-8000-000000000010",
    label: "Bestehender manueller Posten",
    requiredAmount: 2,
    unit: "piece",
    checked: true,
    source: "manual"
  }],
  shoppingCalculationRevision: 4,
  recallSource: { status: "fresh" }
};

describe("ShoppingView generation", () => {
  beforeEach(() => {
    doubles.rpc.mockReset();
    doubles.submitDurableRpc.mockReset();
  });

  afterEach(() => cleanup());

  it("reports an honest offline failure and leaves existing items visible", async () => {
    const onChanged = vi.fn();
    doubles.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ShoppingView snapshot={snapshot} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /plan minus nutzbaren vorrat berechnen/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("ohne Serververbindung");
    expect(screen.getByText("Bestehender manueller Posten")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /plan minus nutzbaren vorrat berechnen/i }).hasAttribute("disabled")).toBe(false));
  });

  it("sends the current calculation base and only confirms a valid server result", async () => {
    const onChanged = vi.fn();
    doubles.rpc.mockResolvedValue({
      data: {
        list_id: "00000000-0000-4000-8000-000000000011",
        calculation_revision: 5,
        calculation_payload_sha256: "a".repeat(64),
        idempotent_replay: false
      },
      error: null
    });
    render(<ShoppingView snapshot={snapshot} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /plan minus nutzbaren vorrat berechnen/i }));

    await waitFor(() => expect(doubles.rpc).toHaveBeenCalledOnce());
    expect(doubles.rpc).toHaveBeenCalledWith("generate_shopping_from_plan_v2", expect.objectContaining({
      target_household: snapshot.household.id,
      target_week_start: "2026-08-03",
      base_calculation_revision: 4,
      mutation_id: expect.any(String)
    }));
    expect((await screen.findByRole("status")).textContent).toContain("Berechnung 5");
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
