/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryItem } from "@/lib/types";
import { InventoryView } from "./inventory-view";

const savedBatch: InventoryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  productId: "22222222-2222-4222-8222-222222222222",
  gtin: "3017624010701",
  name: "Rühls Bestes Whey",
  brand: "Rühl24",
  imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.1.400.jpg",
  remainingLabel: "450 g",
  remainingAmount: 450,
  unit: "g",
  location: "Kühlschrank",
  dateKind: "best_before",
  expiryDate: "30.06.",
  daysUntilExpiry: 329,
  expiryState: "future",
  lotNumber: "LOT-42",
  personalRiskMatches: [],
  recall: { kind: "none", blocksConsumption: false, stale: false, wording: "Kein Rückrufabgleich erforderlich." },
  nutrition: { kcal100g: 380, protein100g: 75, carbs100g: 8, fat100g: 5 }
};

describe("InventoryView", () => {
  afterEach(() => cleanup());

  it("shows the persisted product image, amount, location, MHD and lot in the inventory row", () => {
    render(<InventoryView onScan={vi.fn()} items={[savedBatch]} />);

    const row = screen.getByRole("button", { name: /Rühls Bestes Whey/ });
    expect(within(row).getByText("Kühlschrank")).toBeTruthy();
    expect(within(row).getByText("Rühl24 · 450 g · Charge LOT-42")).toBeTruthy();
    expect(within(row).getByText("MHD")).toBeTruthy();
    expect(within(row).getByText("30.06.")).toBeTruthy();
    expect(row.querySelector("img")?.getAttribute("src")).toContain("front_de.1.400.jpg");
  });
});
