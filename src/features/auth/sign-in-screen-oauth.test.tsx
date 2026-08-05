/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth })
}));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

import { SignInScreen } from "./sign-in-screen";

describe("Google OAuth callback", () => {
  beforeEach(() => {
    auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
    auth.signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    auth.signInWithPassword.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
    auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("uses the server-side PKCE confirmation route", async () => {
    render(<SignInScreen googleEnabled />);

    fireEvent.click(screen.getByRole("button", { name: "Mit Google fortfahren" }));

    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/confirm?next=%2F",
        scopes: "openid email profile"
      }
    }));
  });

  it("uses the canonical server origin for OAuth, signup and password recovery", async () => {
    const canonicalOrigin = "https://app.foodos.example";
    const { unmount } = render(<SignInScreen authCallbackOrigin={canonicalOrigin} googleEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Mit Google fortfahren" }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ redirectTo: `${canonicalOrigin}/auth/confirm?next=%2F` })
    })));
    unmount();

    render(<SignInScreen authCallbackOrigin={canonicalOrigin} />);
    fireEvent.click(screen.getByRole("tab", { name: "Neu hier" }));
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), { target: { value: "person@example.com" } });
    const password = document.querySelector<HTMLInputElement>('input[name="password"]');
    if (!password) throw new Error("Password field was not rendered");
    fireEvent.change(password, { target: { value: "a-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { emailRedirectTo: `${canonicalOrigin}/auth/confirm?next=%2F` }
    })));
    cleanup();

    render(<SignInScreen authCallbackOrigin={canonicalOrigin} />);
    fireEvent.click(screen.getByRole("button", { name: "Passwort vergessen?" }));
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Link zum Zurücksetzen senden" }));
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
      redirectTo: `${canonicalOrigin}/auth/confirm?next=%2Fauth%2Fpasswort-zuruecksetzen`
    }));
  });

  it("does not start a production OAuth flow without a canonical server origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<SignInScreen authCallbackOrigin={null} googleEnabled />);

    fireEvent.click(screen.getByRole("button", { name: "Mit Google fortfahren" }));

    expect((await screen.findByRole("alert")).textContent).toContain("keinen sicheren Anmeldelink");
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });
});
