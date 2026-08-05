"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { mfaChallengeRetryPolicy } from "@/domain/mfa-challenge";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";
import { SignOutButton } from "./sign-out-button";

export type MfaFactorOption = { id: string; label: string };

export function MfaChallengeScreen({ factors }: { factors: MfaFactorOption[] }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const locked = mfaChallengeRetryPolicy(failedAttempts).locked;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setCooldownSeconds((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  function selectFactor(id: string) {
    setFactorId(id);
    setFailedAttempts(0);
    setCooldownSeconds(0);
    setError(null);
  }

  function recordFailure(message: string) {
    const attempts = failedAttempts + 1;
    const policy = mfaChallengeRetryPolicy(attempts);
    setFailedAttempts(attempts);
    setCooldownSeconds(policy.retryAfterSeconds);
    setError(policy.locked
      ? `${message} Für diese Ansicht sind vorerst keine weiteren Versuche möglich.`
      : message);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      setError("Gib den sechsstelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    if (!factorId || locked || cooldownSeconds > 0) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setBusy(false);
      recordFailure("Die Sicherheitsprüfung konnte nicht gestartet werden.");
      return;
    }
    const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    setBusy(false);
    if (result.error) {
      recordFailure("Der Code ist nicht gültig oder bereits abgelaufen.");
      return;
    }
    router.refresh();
  }

  return (
    <AuthFrame eyebrow="Zweiter Faktor" title="Anmeldung bestätigen" description="Öffne deine Authenticator-App und gib den aktuellen FoodOS-Code ein.">
      <form className="auth-form" onSubmit={verify}>
        {factors.length > 1 && (
          <fieldset className="mfa-app-picker">
            <legend>Authenticator auswählen</legend>
            <div className="mfa-app-options">
              {factors.map((factor) => (
                <label className={`mfa-app-option${factor.id === factorId ? " selected" : ""}`} key={factor.id}>
                  <input type="radio" name="mfa-factor" value={factor.id} checked={factor.id === factorId} onChange={() => selectFactor(factor.id)} />
                  <span><strong>{factor.label}</strong><small>Verifizierter TOTP-Faktor</small></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label>
          <span>Sechsstelliger Code</span>
          <div><KeyRound size={18} aria-hidden="true" /><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus required /></div>
        </label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        {cooldownSeconds > 0 && <p className="auth-message" role="status">Nächster Versuch in {cooldownSeconds} Sekunden.</p>}
        <details className="mfa-secret">
          <summary>Code wird abgelehnt?</summary>
          <div className="mfa-secret-body"><p>Öffne auf deinem Gerät Einstellungen → Datum &amp; Uhrzeit und aktiviere „Automatisch“. Warte danach auf den nächsten 30-Sekunden-Code und gib nur diesen ein.</p></div>
        </details>
        <button className="primary-button wide" disabled={busy || locked || cooldownSeconds > 0 || !factorId}>{busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}FoodOS entsperren</button>
      </form>
      <details className="mfa-secret">
        <summary>Kein Zugriff auf deine Authenticator-App?</summary>
        <div className="mfa-secret-body">
          <p>Nutze oben einen anderen verifizierten Faktor. Wenn keiner verfügbar ist, melde dieses Gerät sicher ab. Danach kannst du im Anmeldefenster die Passwort-Wiederherstellung starten; sie ersetzt 2FA nicht und öffnet keine privaten Daten.</p>
          <SignOutButton variant="settings" />
        </div>
      </details>
    </AuthFrame>
  );
}
