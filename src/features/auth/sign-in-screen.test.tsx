/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

import { SignInScreen } from "./sign-in-screen";

describe("SignInScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains the honest no-provider state instead of rendering broken provider buttons", () => {
    render(<SignInScreen demoEnabled />);

    expect(screen.getByRole("status").textContent).toContain("Apple- und Google-Anmeldung stehen auf dieser FoodOS-Installation noch nicht zur Verfügung");
    expect(screen.queryByRole("button", { name: "Mit Apple fortfahren" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mit Google fortfahren" })).toBeNull();
    expect(screen.getByRole("button", { name: "FoodOS ausprobieren" })).toBeTruthy();
    expect(screen.getByText("Mit E-Mail weitermachen", { exact: true })).toBeTruthy();
  });

  it("shows the provider group once at least one OAuth provider is genuinely enabled", () => {
    render(<SignInScreen appleEnabled googleEnabled />);

    expect(screen.getByRole("group", { name: "Mit einem Konto anmelden" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mit Apple fortfahren" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mit Google fortfahren" })).toBeTruthy();
    expect(screen.queryByText("Apple- und Google-Anmeldung stehen auf dieser FoodOS-Installation noch nicht zur Verfügung")).toBeNull();
  });
});
