/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scanner = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn()
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints(...args: unknown[]) {
      return scanner.decode(...args);
    }
  }
}));

import { ScanView } from "./scan-view";

describe("ScanView camera", () => {
  beforeEach(() => {
    scanner.decode.mockReset();
    scanner.stop.mockReset();
    scanner.decode.mockResolvedValue({ stop: scanner.stop });
  });

  afterEach(() => cleanup());

  it("prefers the rear camera and exposes a visible stop action", async () => {
    render(<ScanView preview />);

    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));

    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce());
    expect(scanner.decode.mock.calls[0]?.[0]).toMatchObject({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Kamera beenden" }));
    expect(scanner.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Kamera starten" })).toBeTruthy();
  });
});
