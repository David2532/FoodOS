"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

type Enrollment = { factorId: string; qrCode: string; secret: string };
type AuthenticatorApp = "google" | "microsoft" | "apple" | "other";

type AuthenticatorOption = {
  id: AuthenticatorApp;
  label: string;
  description: string;
  friendlyName: string;
  instruction: string;
};

const authenticatorOptions: readonly AuthenticatorOption[] = [
  {
    id: "google",
    label: "Google Authenticator",
    description: "Öffne die App und nutze ihren QR-Scanner.",
    friendlyName: "Google Authenticator",
    instruction: "Öffne Google Authenticator auf deinem Handy. Tippe auf + und wähle anschließend „QR-Code scannen“."
  },
  {
    id: "microsoft",
    label: "Microsoft Authenticator",
    description: "Füge FoodOS als anderes Konto hinzu.",
    friendlyName: "Microsoft Authenticator",
    instruction: "Öffne Microsoft Authenticator auf deinem Handy. Tippe auf +, wähle „Anderes Konto“ und dann „QR-Code scannen“."
  },
  {
    id: "apple",
    label: "Apple Passwörter",
    description: "Sichere den Code in Passwörter auf dem iPhone.",
    friendlyName: "Apple Passwörter",
    instruction: "Scanne den QR-Code mit der iPhone-Kamera und speichere den Bestätigungscode in Passwörter."
  },
  {
    id: "other",
    label: "Andere TOTP-App",
    description: "Zum Beispiel 2FAS, Aegis oder Authy.",
    friendlyName: "FoodOS Authenticator",
    instruction: "Öffne deine Authenticator-App, füge ein Konto hinzu und nutze dort den QR-Code-Scanner."
  }
];

export function MfaEnrollmentScreen({ loading = false, initialError }: { loading?: boolean; initialError?: string }) {
  const router = useRouter();
  const mounted = useRef(true);
  const pendingFactorId = useRef<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [authenticatorApp, setAuthenticatorApp] = useState<AuthenticatorApp>("google");
  const [manualSetupOpen, setManualSetupOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const selectedAuthenticator = authenticatorOptions.find((option) => option.id === authenticatorApp) ?? authenticatorOptions[0];

  async function removeUnverifiedFactor(factorId: string): Promise<boolean> {
    try {
      const result = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
      return !result.error;
    } catch {
      return false;
    }
  }

  useEffect(() => () => {
    mounted.current = false;
    const factorId = pendingFactorId.current;
    pendingFactorId.current = null;
    if (factorId) void removeUnverifiedFactor(factorId);
  }, []);

  async function begin() {
    setBusy(true);
    setError(null);
    setManualSetupOpen(false);
    setCopyFeedback("idle");
    const result = await getSupabaseBrowserClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: selectedAuthenticator.friendlyName
    });
    setBusy(false);
    if (result.error) {
      if (mounted.current) setError("2FA konnte nicht vorbereitet werden. Lade die Seite neu und versuche es erneut.");
      return;
    }
    pendingFactorId.current = result.data.id;
    if (!mounted.current) {
      pendingFactorId.current = null;
      void removeUnverifiedFactor(result.data.id);
      return;
    }
    setEnrollment({ factorId: result.data.id, qrCode: result.data.totp.qr_code, secret: result.data.totp.secret });
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const removed = await removeUnverifiedFactor(enrollment.factorId);
    if (!mounted.current) return;
    setBusy(false);
    if (!removed) {
      setError("Die unbestätigte 2FA-Einrichtung konnte nicht sicher verworfen werden. Lade die Seite neu und versuche es erneut.");
      return;
    }
    pendingFactorId.current = null;
    setEnrollment(null);
  }

  async function copySetupSecret() {
    if (!enrollment || !navigator.clipboard?.writeText) {
      setCopyFeedback("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      setError("Gib den sechsstelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
    if (challenge.error) {
      setBusy(false);
      setError("Die 2FA-Prüfung konnte nicht gestartet werden.");
      return;
    }
    const result = await supabase.auth.mfa.verify({ factorId: enrollment.factorId, challengeId: challenge.data.id, code });
    setBusy(false);
    if (result.error) {
      setError("Der Code ist nicht gültig oder bereits abgelaufen. Versuche den aktuellen Code.");
      return;
    }
    pendingFactorId.current = null;
    router.refresh();
  }

  return (
    <AuthFrame showSignOut eyebrow="Schritt 2 von 2" title="2FA aktivieren" description="FoodOS verlangt einen zweiten Faktor, bevor persönliche Vorrats- und Ernährungsdaten geöffnet werden.">
      {!enrollment ? (
        <div className="mfa-intro">
          <span><ShieldCheck size={26} /></span>
          <h2>Authenticator-App verbinden</h2>
          <p>Wähle die App, die du für FoodOS verwenden möchtest. Google Authenticator, Microsoft Authenticator, Apple Passwörter und andere TOTP-Apps funktionieren mit demselben sicheren Standard.</p>
          <fieldset className="mfa-app-picker">
            <legend>Welche App möchtest du verwenden?</legend>
            <p>FoodOS kann installierte Apps aus Datenschutzgründen nicht auslesen. Öffne die ausgewählte App anschließend selbst.</p>
            <div className="mfa-app-options">
              {authenticatorOptions.map((option) => (
                <label className={`mfa-app-option${option.id === authenticatorApp ? " selected" : ""}`} key={option.id}>
                  <input
                    type="radio"
                    name="authenticator-app"
                    value={option.id}
                    checked={option.id === authenticatorApp}
                    onChange={() => setAuthenticatorApp(option.id)}
                  />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button className="primary-button wide" onClick={begin} disabled={busy || loading}>
            {(busy || loading) && <LoaderCircle className="spin" size={17} />}
            {loading ? "2FA-Status wird geprüft …" : `QR-Code für ${selectedAuthenticator.label} erzeugen`}
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={verify}>
          <section className="mfa-setup" aria-labelledby="mfa-setup-title">
            <h2 id="mfa-setup-title">FoodOS in {selectedAuthenticator.label} einrichten</h2>
            <div className="mfa-qr">
              {/* Supabase returns a data URL containing its generated SVG. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt={`QR-Code zum Einrichten von FoodOS in ${selectedAuthenticator.label}`} />
            </div>
            <div className="mfa-app-instructions" role="status" aria-live="polite">
              <strong>{selectedAuthenticator.label}</strong>
              <p>{selectedAuthenticator.instruction}</p>
            </div>
            <p className="mfa-scan-note"><strong>Hinweis für iPhone:</strong> Wenn du Google oder Microsoft Authenticator verwenden möchtest, öffne deren App zuerst und scanne den Code dort. Die iPhone-Kamera leitet denselben Code zu Apple Passwörter weiter.</p>
            <details className="mfa-secret" onToggle={(event) => {
              setManualSetupOpen(event.currentTarget.open);
              setCopyFeedback("idle");
            }}>
              <summary><QrCode size={16} /> Setup-Schlüssel manuell verwenden</summary>
              {manualSetupOpen && (
                <div className="mfa-secret-body">
                  <p>In deiner App „manuell einrichten“ wählen, den Schlüssel einfügen und „zeitbasiert (TOTP)“ mit sechs Stellen verwenden.</p>
                  <code aria-label="Setup-Schlüssel für FoodOS">{enrollment.secret}</code>
                  <button type="button" onClick={copySetupSecret}><Copy size={15} /> Schlüssel kopieren</button>
                  {copyFeedback === "copied" && <p className="mfa-copy-feedback" role="status">Schlüssel kopiert. Teile ihn mit niemandem.</p>}
                  {copyFeedback === "failed" && <p className="mfa-copy-feedback error" role="alert">Kopieren war nicht möglich. Markiere den Schlüssel und kopiere ihn manuell.</p>}
                </div>
              )}
            </details>
          </section>
          <label>
            <span>Sechsstelliger Code</span>
            <div><ShieldCheck size={18} /><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></div>
          </label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}2FA bestätigen</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={cancelEnrollment}>Einrichtung abbrechen und Faktor verwerfen</button>
        </form>
      )}
    </AuthFrame>
  );
}
