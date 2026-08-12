"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { passwordResetSchema } from "@/domain/password";
import { clearStagedPrivacyChoice } from "@/features/privacy/privacy-client";
import { clearOfflineData } from "@/infrastructure/offline-outbox";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";
import { retryRecoverySessionRevocation, updatePasswordFromRecovery } from "./password-reset-api";
import { finalizePasswordResetSessions, type PasswordResetSessionFinalization } from "./password-reset-session";

type PasswordResetCompletion = PasswordResetSessionFinalization | "server-revocation-required";

export function PasswordResetScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [sessionFinalization, setSessionFinalization] = useState<PasswordResetCompletion | null>(null);

  async function clearCurrentDeviceSession(): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The global server revoke can make this remote call fail after the SDK has
      // already removed browser storage. Verify the local state below.
    }
    try {
      const result = await supabase.auth.getSession();
      return !result.error && !result.data.session;
    } catch {
      return false;
    }
  }

  async function finalizeSessions() {
    setSessionFinalization(null);
    const finalization = await finalizePasswordResetSessions({ clearOfflineData, clearCurrentDeviceSession });
    if (finalization === "complete") clearStagedPrivacyChoice();
    setSessionFinalization(finalization);
  }

  async function retryLocalFinalization() {
    setBusy(true);
    setError(null);
    await finalizeSessions();
    setBusy(false);
  }

  async function retryServerRevocation() {
    setBusy(true);
    setError(null);
    const result = await retryRecoverySessionRevocation();
    if (result.kind === "complete") await finalizeSessions();
    else if (result.kind === "revocation-required") setSessionFinalization("server-revocation-required");
    else setError("Der Sitzungswiderruf konnte nicht bestätigt werden. Versuche es erneut oder fordere einen neuen Link an.");
    setBusy(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = passwordResetSchema.safeParse({
      newPassword: formData.get("newPassword"),
      passwordConfirmation: formData.get("passwordConfirmation")
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Eingaben.");
      return;
    }

    setBusy(true);
    const result = await updatePasswordFromRecovery(parsed.data);
    if (result.kind === "error") {
      setBusy(false);
      setError("Das Passwort konnte nicht zurückgesetzt werden. Fordere bei Bedarf einen neuen Link an.");
      return;
    }
    form.reset();
    setPasswordUpdated(true);
    if (result.kind === "complete") await finalizeSessions();
    else setSessionFinalization("server-revocation-required");
    setBusy(false);
  }

  if (passwordUpdated && !sessionFinalization) {
    return (
      <AuthFrame eyebrow="Passwort gespeichert" title="Sitzungen werden beendet" description="Dein neues Passwort wurde gespeichert. FoodOS beendet jetzt die aktiven Sitzungen.">
        <div className="auth-complete" role="status"><LoaderCircle className="spin" size={30} aria-hidden="true" /><p>Sitzungen werden sicher beendet …</p></div>
      </AuthFrame>
    );
  }

  if (sessionFinalization) {
    const allSessionsRevoked = sessionFinalization === "complete";
    const serverRevocationRequired = sessionFinalization === "server-revocation-required";
    const offlineCleanupPending = sessionFinalization === "offline-cleanup-pending";
    const offlineCleanupUnconfirmed = sessionFinalization === "offline-cleanup-unconfirmed";
    return (
      <AuthFrame
        eyebrow={allSessionsRevoked ? "Passwort geändert" : "Passwort gespeichert"}
        title={allSessionsRevoked ? "Alles erledigt" : "Sicherheitsabschluss noch offen"}
        description={allSessionsRevoked
          ? "Melde dich mit deinem neuen Passwort erneut an. Für private Daten ist anschließend weiterhin deine 2FA erforderlich."
          : "Dein neues Passwort ist gespeichert. FoodOS zeigt erst nach dem bestätigten Sitzungswiderruf und der sicheren lokalen Datenentfernung einen Abschluss an."}
      >
        <div className={`auth-complete ${allSessionsRevoked ? "" : "incomplete"}`}>
          {allSessionsRevoked ? <CheckCircle2 size={30} aria-hidden="true" /> : <AlertTriangle size={30} aria-hidden="true" />}
          {allSessionsRevoked && <p>Alle aktiven Sitzungen wurden vorsorglich beendet.</p>}
          {serverRevocationRequired && <>
            <p className="auth-message error" role="alert">Der Server konnte den Widerruf aller Sitzungen noch nicht bestätigen.</p>
            <p>Versuche den Widerruf erneut. Bis dahin zeigt FoodOS keinen abgeschlossenen Sicherheitsstatus an.</p>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            <div className="settings-form-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void retryServerRevocation()}>{busy && <LoaderCircle className="spin" size={17} />}<RefreshCw size={17} aria-hidden="true" /> Sitzungswiderruf erneut versuchen</button>
            </div>
          </>}
          {offlineCleanupPending && <>
            <p className="auth-message error" role="alert">Die Löschung lokaler Offline-Daten ist noch nicht bestätigt.</p>
            <p>Schließe weitere FoodOS-Tabs und entferne die lokalen Daten erneut. Der Abschluss bleibt bis dahin offen.</p>
            <div className="settings-form-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void retryLocalFinalization()}>{busy && <LoaderCircle className="spin" size={17} />}<RefreshCw size={17} aria-hidden="true" /> Lokale Daten erneut entfernen</button>
            </div>
          </>}
          {offlineCleanupUnconfirmed && <>
            <p className="auth-message error" role="alert">Die sichere Entfernung lokaler Offline-Daten konnte nicht bestätigt werden.</p>
            <p>Prüfe den Browser-Speicher und entferne die lokalen Daten erneut. Der Abschluss bleibt bis dahin offen.</p>
            <div className="settings-form-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void retryLocalFinalization()}>{busy && <LoaderCircle className="spin" size={17} />}<RefreshCw size={17} aria-hidden="true" /> Lokale Daten erneut entfernen</button>
            </div>
          </>}
          {sessionFinalization === "local-sign-out-required" && <>
            <p className="auth-message error" role="alert">Die Abmeldung dieses Geräts konnte noch nicht bestätigt werden.</p>
            <p>Die lokalen Offline-Daten wurden entfernt. Wiederhole die Abmeldung dieses Geräts, bevor du den Abschluss verlässt.</p>
            <div className="settings-form-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void retryLocalFinalization()}>{busy && <LoaderCircle className="spin" size={17} />}<RefreshCw size={17} aria-hidden="true" /> Dieses Gerät erneut abmelden</button>
            </div>
          </>}
          {allSessionsRevoked && <Link className="primary-button wide" href="/">Zur Anmeldung</Link>}
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame eyebrow="Verifizierter Link" title="Neues Passwort festlegen" description="Nutze ein neues, einzigartiges Passwort. Der Link berechtigt nie zum Zugriff auf private Haushaltsdaten ohne 2FA.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>
          <span>Neues Passwort</span>
          <div><KeyRound size={18} aria-hidden="true" /><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
        </label>
        <label>
          <span>Neues Passwort wiederholen</span>
          <div><ShieldCheck size={18} aria-hidden="true" /><input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
        </label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}Passwort sicher speichern</button>
      </form>
    </AuthFrame>
  );
}
