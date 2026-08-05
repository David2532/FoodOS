/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductCatalogSearch } from "./product-catalog-search";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function searchResponse(nutrition: Record<string, number> = {}) {
  return {
    query: "Rühls Bestes Whey",
    page: 1,
    pageSize: 12,
    providerCount: 12,
    providerCountExact: false,
    cachedCount: 0,
    globalCatalogCount: 0,
    globalCatalogStatus: "not-configured",
    providerStatus: "live",
    hasMore: false,
    results: [{
      barcode: "4260121341527",
      name: "Whey Protein Konzentrat",
      brand: "Rühls Bestes",
      quantity: "1 kg",
      nutriScore: "a",
      nutrition,
      source: "open-food-facts",
      confidence: 0.86
    }]
  };
}

describe("ProductCatalogSearch", () => {
  it("renders real search nutrition before selection and keeps selection explicit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(searchResponse({
      kcal100g: 371,
      protein100g: 74,
      carbs100g: 8.2,
      fat100g: 5.5
    })), { status: 200 })));
    const onSelect = vi.fn();

    render(<ProductCatalogSearch preview onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Rühls Bestes Whey" }));

    expect(await screen.findByRole("heading", { name: "Whey Protein Konzentrat" })).toBeTruthy();
    expect(screen.getByLabelText("Nährwerte pro 100 Gramm oder Milliliter")).toBeTruthy();
    expect(screen.getByText("371")).toBeTruthy();
    expect(screen.getByText("74 g")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /prüfen/i }));
    expect(onSelect).toHaveBeenCalledWith("4260121341527");
  });

  it("labels missing nutrition as unknown instead of displaying zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(searchResponse()), { status: 200 })));

    render(<ProductCatalogSearch preview initialQuery="Rühls Bestes Whey" onSelect={vi.fn()} />);

    expect(await screen.findByText("Nährwerte nicht angegeben")).toBeTruthy();
    expect(screen.queryByText(/^0(?:[,.]0)?$/)).toBeNull();
  });
});
