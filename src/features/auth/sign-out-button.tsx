"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { clearStagedPrivacyChoice } from "@/features/privacy/privacy-client";
import {
  clearOfflineData,
  getOfflineDataStorageState,
  getOutboxSummary,
  type OfflineDataCleanupResult,
  waitForOfflineDataCleanupCompletion
} from "@/infrastructure/offline-outbox";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const cleanupPendingMessage = "Die Löschung lokaler Offline-Daten ist noch nicht bestätigt. Schließe weitere FoodOS-Tabs; die Abmeldung wird automatisch fortgesetzt, sobald die Löschung bestätigt ist. Du bleibst bis dahin angemeldet.";
const cleanupUnconfirmedMessage = "Die sichere Entfernung lokaler Offline-Daten konnte nicht bestätigt werden. Du bleibst angemeldet. Prüfe den Browser-Speicher und versuche die Abmeldung erneut.";
const summaryFailureMessage = "Die lokale Offline-Warteschlange konnte nicht sicher gelesen werden. Du bleibst angemeldet. Prüfe den Browser-Speicher und versuche es erneut.";
const signOutFailureMessage = "Die lokale Löschung wurde bestätigt, aber FoodOS konnte die Abmeldung nicht bestätigen. Versuche es erneut, bevor du dieses Gerät unbeaufsichtigt lässt.";
const householdSelectionCleanupFailureMessage = "Die lokale Löschung wurde bestätigt, aber die Haushaltsauswahl konnte nicht sicher entfernt werden. Du bleibst angemeldet und kannst die Abmeldung erneut versuchen.";

export function SignOutButton({ variant = "icon" }: { variant?: "icon" | "settings" }) {
  const router = useRouter();
  const errorId = useId();
  const signOutInFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (signOutInFlight.current) return;
    signOutInFlight.current = true;
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
        if (summary.uncertain > 0) {
          const confirmation = window.confirm(
            `${summary.uncertain} Einkauf${summary.uncertain === 1 ? " kann" : "svorgänge können"} bereits auf dem Server gebucht worden sein, aber die Bestätigung ist unvollständig. FoodOS darf ${summary.uncertain === 1 ? "diesen Vorgang" : "diese Vorgänge"} weder erneut senden noch als abgelehnt verwerfen.${pending > 0 ? ` Zusätzlich ${pending === 1 ? "wartet 1 bestätigte Änderung" : `warten ${pending} bestätigte Änderungen`} noch auf Synchronisierung.` : ""} Beim sicheren Abmelden müssen die verschlüsselten lokalen Daten entfernt werden; danach ist kein automatischer Abgleich mehr möglich. Trotzdem sicher abmelden?`
          );
          if (!confirmation) return;
        } else {
          const confirmation = pending === 0 || window.confirm(
          `${pending} bestätigte Änderung${pending === 1 ? " ist" : "en sind"} noch nicht mit dem Server synchronisiert. FoodOS setzt die Abmeldung erst fort, wenn ihre lokalen Daten sicher entfernt wurden. Trotzdem abmelden?`
          );
          if (!confirmation) return;
        }
      }

      let cleanup: OfflineDataCleanupResult;
      try {
        cleanup = await clearOfflineData();
        if (cleanup.status === "pending") {
          setError(cleanupPendingMessage);
          cleanup = await waitForOfflineDataCleanupCompletion();
        }
      } catch {
        setError(cleanupUnconfirmedMessage);
        return;
      }
      if (cleanup.status === "unconfirmed") {
        setError(cleanupUnconfirmedMessage);
        return;
      }

      try {
        const selectionCleanup = await fetch("/api/households/select", {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (!selectionCleanup.ok) {
          setError(householdSelectionCleanupFailureMessage);
          return;
        }
      } catch {
        setError(householdSelectionCleanupFailureMessage);
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
      signOutInFlight.current = false;
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
