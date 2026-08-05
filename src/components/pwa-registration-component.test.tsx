/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaRegistration } from "./pwa-registration";

describe("PwaRegistration in development", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("removes stale production workers so they cannot intercept local OAuth callbacks", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations } });

    render(<PwaRegistration />);

    await waitFor(() => expect(getRegistrations).toHaveBeenCalledOnce());
    await waitFor(() => expect(unregister).toHaveBeenCalledOnce());
  });
});
