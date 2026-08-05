/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } })
}));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

import { SignInScreen } from "./sign-in-screen";

describe("Google OAuth callback", () => {
  it("uses the server-side PKCE confirmation route", async () => {
    render(<SignInScreen googleEnabled />);

    fireEvent.click(screen.getByRole("button", { name: "Mit Google fortfahren" }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/confirm?next=%2F",
        scopes: "openid email profile"
      }
    }));
  });
});
