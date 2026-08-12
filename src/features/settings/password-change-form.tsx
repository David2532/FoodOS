"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import { passwordChangeSchema } from "@/domain/password";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function needsReauthentication(error: { code?: string; message?: string }): boolean {
  return error.code === "reauthentication_needed" || /reauthentication|security code|nonce/i.test(error.message ?? "");
}

export function PasswordChangeForm() {
  const [busy, setBusy] = useState(false);
  const [nonceRequired, setNonceRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestSecurityCode() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await getSupabaseBrowserClient().auth.reauthenticate();
    setBusy(false);
    if (result.error) {
      setError("Der Sicherheitscode konnte gerade nicht angefordert werden. Versuche es später erneut.");
      return;
    }
    setNonceRequired(true);
    setNotice("Wir haben einen Sicherheitscode an deine hinterlegte E-Mail-Adresse gesendet.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      passwordConfirmation: formData.get("passwordConfirmation"),
      nonce: formData.get("nonce") || undefined
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Eingaben.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
      current_password: parsed.data.currentPassword,
      password: parsed.data.newPassword,
      ...(parsed.data.nonce ? { nonce: parsed.data.nonce } : {})
    });
    if (updateError) {
      setBusy(false);
      if (needsReauthentication(updateError)) {
        setNonceRequired(true);
        setError("Bestätige den Passwortwechsel mit dem Sicherheitscode aus deiner E-Mail.");
        return;
      }
      setError("Das Passwort konnte nicht geändert werden. Prüfe dein aktuelles Passwort und versuche es erneut.");
      return;
    }

    const { error: otherSessionsError } = await getSupabaseBrowserClient().auth.signOut({ scope: "others" });
    setBusy(false);
    form.reset();
    setNonceRequired(false);
    setNotice(otherSessionsError
      ? "Dein Passwort wurde geändert. Andere Geräte konnten noch nicht automatisch abgemeldet werden."
      : "Dein Passwort wurde geändert. Andere angemeldete Geräte wurden abgemeldet.");
  }

  return (
    <form className="auth-form password-change-form" onSubmit={submit} noValidate>
      <p className="settings-form-copy">Nutze ein neues Passwort mit mindestens 12 Zeichen. Ein Passwortwechsel meldet andere Geräte vorsorglich ab.</p>
      <label>
        <span>Aktuelles Passwort</span>
        <div><KeyRound size={18} aria-hidden="true" /><input name="currentPassword" type="password" autoComplete="current-password" required /></div>
      </label>
      <label>
        <span>Neues Passwort</span>
        <div><ShieldCheck size={18} aria-hidden="true" /><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      </label>
      <label>
        <span>Neues Passwort wiederholen</span>
        <div><ShieldCheck size={18} aria-hidden="true" /><input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      </label>
      {nonceRequired && <label>
        <span>Sicherheitscode aus der E-Mail</span>
        <div><MailCheck size={18} aria-hidden="true" /><input name="nonce" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={64} required /></div>
      </label>}
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {notice && <p className="auth-message success" role="status">{notice}</p>}
      <div className="settings-form-actions">
        <button className="primary-button" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}Passwort ändern</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void requestSecurityCode()}>
          <MailCheck size={17} aria-hidden="true" /> Sicherheitscode anfordern
        </button>
      </div>
    </form>
  );
}
