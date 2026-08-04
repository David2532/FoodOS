"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { clearStagedPrivacyChoice } from "@/features/privacy/privacy-client";
import { clearOfflineData, getOfflineDataStorageState, getOutboxSummary } from "@/infrastructure/offline-outbox";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const cleanupPendingMessage = "Die Löschung lokaler Offline-Daten ist noch nicht bestätigt. Schließe weitere FoodOS-Tabs und versuche die Abmeldung erneut. Du bleibst angemeldet, bis die Löschung bestätigt ist.";
const cleanupUnconfirmedMessage = "Die sichere Entfernung lokaler Offline-Daten konnte nicht bestätigt werden. Du bleibst angemeldet. Prüfe den Browser-Speicher und versuche die Abmeldung erneut.";
const summaryFailureMessage = "Die lokale Offline-Warteschlange konnte nicht sicher gelesen werden. Du bleibst angemeldet. Prüfe den Browser-Speicher und versuche es erneut.";
const signOutFailureMessage = "Die lokale Löschung wurde bestätigt, aber FoodOS konnte die Abmeldung nicht bestätigen. Versuche es erneut, bevor du dieses Gerät unbeaufsichtigt lässt.";

export function SignOutButton({ variant = "icon" }: { variant?: "icon" | "settings" }) {
  const router = useRouter();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setError(null);

    try {
      if (getOfflineDataStorageState() === "available") {
        let summary;
        try {
          summary = await getOutboxSummary();
        } catch {
          setError(summaryFailureMessage);
          return;
        }
        const pending = summary.queued + summary.sending;
        const confirmation = pending === 0 || window.confirm(
          `${pending} bestätigte Änderung${pending === 1 ? " ist" : "en sind"} noch nicht mit dem Server synchronisiert. FoodOS setzt die Abmeldung erst fort, wenn ihre lokalen Daten sicher entfernt wurden. Trotzdem abmelden?`
        );
        if (!confirmation) return;
      }

      let cleanup;
      try {
        cleanup = await clearOfflineData();
      } catch {
        setError(cleanupUnconfirmedMessage);
        return;
      }
      if (cleanup.status === "pending") {
        setError(cleanupPendingMessage);
        return;
      }
      if (cleanup.status === "unconfirmed") {
        setError(cleanupUnconfirmedMessage);
        return;
      }

      let signOutError: unknown;
      try {
        ({ error: signOutError } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" }));
      } catch {
        setError(signOutFailureMessage);
        return;
      }
      if (signOutError) {
        setError(signOutFailureMessage);
        return;
      }

      clearStagedPrivacyChoice();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`sign-out-control ${variant === "icon" ? "compact" : ""}`}>
      <button
        className={variant === "settings" ? "settings-action danger" : "icon-button"}
        type="button"
        aria-label={variant === "icon" ? "Sicher abmelden" : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-busy={busy}
        disabled={busy}
        onClick={signOut}
      >
        <LogOut size={19} aria-hidden="true" />
        {variant === "settings" && <span><strong>Sicher abmelden</strong><small>Dieses Gerät abmelden und lokale Offline-Daten sicher entfernen.</small></span>}
      </button>
      {error && <p className="auth-message error sign-out-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
