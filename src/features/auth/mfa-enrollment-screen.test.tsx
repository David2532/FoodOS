/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      mfa: {
        enroll: state.enroll,
        unenroll: state.unenroll,
        challenge: state.challenge,
        verify: state.verify
      }
    }
  })
}));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

import { MfaEnrollmentScreen } from "./mfa-enrollment-screen";

const enrollmentResult = {
  data: {
    id: "factor-123",
    totp: {
      qr_code: "data:image/svg+xml;base64,PHN2Zy8+",
      secret: "JBSWY3DPEHPK3PXP"
    }
  },
  error: null
};

describe("MfaEnrollmentScreen", () => {
  beforeEach(() => {
    state.unenroll.mockReset().mockResolvedValue({ data: { id: "factor-123" }, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the selected authenticator label and explains the Microsoft scan path", async () => {
    state.enroll.mockResolvedValue(enrollmentResult);
    const user = userEvent.setup();

    render(<MfaEnrollmentScreen />);

    expect(screen.getByRole("group", { name: "Welche App möchtest du verwenden?" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Microsoft Authenticator/ }));
    await user.click(screen.getByRole("button", { name: "QR-Code für Microsoft Authenticator erzeugen" }));

    await waitFor(() => expect(state.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Microsoft Authenticator"
    }));
    expect(screen.getByRole("img", { name: "QR-Code zum Einrichten von FoodOS in Microsoft Authenticator" })).toBeTruthy();
    expect(screen.getByText(/wähle „Anderes Konto“ und dann „QR-Code scannen“/)).toBeTruthy();
    expect(screen.getByText(/Die iPhone-Kamera leitet denselben Code zu Apple Passwörter weiter/)).toBeTruthy();
    expect(screen.queryByLabelText("Setup-Schlüssel für FoodOS")).toBeNull();
  });

  it("reveals the setup secret only on request and confirms a safe copy", async () => {
    state.enroll.mockResolvedValue(enrollmentResult);
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<MfaEnrollmentScreen />);
    await user.click(screen.getByRole("button", { name: "QR-Code für Google Authenticator erzeugen" }));
    await screen.findByRole("img", { name: "QR-Code zum Einrichten von FoodOS in Google Authenticator" });
    expect(screen.queryByLabelText("Setup-Schlüssel für FoodOS")).toBeNull();

    await user.click(screen.getByText("Setup-Schlüssel manuell verwenden", { exact: true }));
    expect(screen.getByLabelText("Setup-Schlüssel für FoodOS").textContent).toContain("JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: "Schlüssel kopieren" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP"));
    expect(screen.getByText("Schlüssel kopiert. Teile ihn mit niemandem.")).toBeTruthy();
  });

  it("removes an unverified factor when enrollment is abandoned", async () => {
    state.enroll.mockResolvedValue(enrollmentResult);
    const user = userEvent.setup();
    const view = render(<MfaEnrollmentScreen />);

    await user.click(screen.getByRole("button", { name: "QR-Code für Google Authenticator erzeugen" }));
    await screen.findByRole("img", { name: "QR-Code zum Einrichten von FoodOS in Google Authenticator" });
    view.unmount();

    await waitFor(() => expect(state.unenroll).toHaveBeenCalledWith({ factorId: "factor-123" }));
  });

  it("explicitly discards an unfinished enrollment before offering a new one", async () => {
    state.enroll.mockResolvedValue(enrollmentResult);
    const user = userEvent.setup();
    render(<MfaEnrollmentScreen />);

    await user.click(screen.getByRole("button", { name: "QR-Code für Google Authenticator erzeugen" }));
    await screen.findByRole("img", { name: "QR-Code zum Einrichten von FoodOS in Google Authenticator" });
    await user.click(screen.getByRole("button", { name: "Einrichtung abbrechen und Faktor verwerfen" }));

    await waitFor(() => expect(state.unenroll).toHaveBeenCalledWith({ factorId: "factor-123" }));
    expect(screen.getByRole("button", { name: "QR-Code für Google Authenticator erzeugen" })).toBeTruthy();
  });
});
