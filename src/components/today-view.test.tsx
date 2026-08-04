/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayView } from "./today-view";

afterEach(() => cleanup());

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
});
