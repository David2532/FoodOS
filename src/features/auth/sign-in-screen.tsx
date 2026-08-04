"use client";

import { useState, type FormEvent } from "react";
import { Apple, AtSign, KeyRound, LoaderCircle, Mail, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { emailAddressSchema, passwordSignInSchema, passwordSignUpSchema } from "@/domain/password";
import { oauthCallbackUrl } from "@/domain/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

type Mode = "login" | "register";
type EntryScreen = "credentials" | "recovery";
type OAuthProvider = "apple" | "google";

const authErrorMessages: Record<string, string> = {
  oauth: "Die Anmeldung beim Identitätsanbieter wurde abgebrochen oder abgelehnt. Versuche es erneut.",
  confirmation: "Der Anmeldelink ist ungültig oder abgelaufen. Starte die Anmeldung erneut.",
  recovery: "Der Passwort-Link ist ungültig oder abgelaufen. Fordere einen neuen Link an."
};

function ProviderMark({ provider }: { provider: OAuthProvider }) {
  if (provider === "apple") {
    return <span className="provider-mark provider-mark-apple" aria-hidden="true"><Apple size={17} strokeWidth={2.2} /></span>;
  }
  return <span className="provider-mark provider-mark-google" aria-hidden="true"><span>G</span></span>;
}

export function SignInScreen({
  authError,
  appleEnabled = false,
  demoEnabled = false,
  googleEnabled = false,
  onEditPrivacy
}: {
  authError?: string;
  appleEnabled?: boolean;
  demoEnabled?: boolean;
  googleEnabled?: boolean;
  onEditPrivacy?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [screen, setScreen] = useState<EntryScreen>(authError === "recovery" ? "recovery" : "credentials");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(authError ? authErrorMessages[authError] ?? "Die Anmeldung konnte nicht bestätigt werden." : null);
  const [notice, setNotice] = useState<string | null>(null);

  function returnToCredentials() {
    setScreen("credentials");
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const parsed = (mode === "login" ? passwordSignInSchema : passwordSignUpSchema).safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Eingaben.");
      return;
    }

    setEmail(parsed.data.email);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword(parsed.data)
      : await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: oauthCallbackUrl(window.location.origin) }
        });
    setBusy(false);

    if (result.error) {
      setError(mode === "login"
        ? "Anmeldung fehlgeschlagen. Prüfe E-Mail, Passwort und die E-Mail-Bestätigung."
        : "Das Konto konnte nicht erstellt werden. Prüfe deine Eingaben und versuche es später erneut.");
      return;
    }

    if (mode === "register" && !result.data.session) {
      setNotice("Konto angelegt. Bestätige jetzt den Link in deiner E-Mail.");
      return;
    }

    router.refresh();
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = emailAddressSchema.safeParse(new FormData(event.currentTarget).get("email"));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine E-Mail-Adresse.");
      return;
    }

    setEmail(parsed.data);
    setBusy(true);
    const result = await getSupabaseBrowserClient().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: oauthCallbackUrl(window.location.origin, "/auth/passwort-zuruecksetzen")
    });
    setBusy(false);
    if (result.error) {
      setError("Der Link konnte gerade nicht angefordert werden. Prüfe deine Verbindung und versuche es später erneut.");
      return;
    }
    setNotice("Wenn zu dieser Adresse ein FoodOS-Konto gehört, kommt in Kürze ein Link zum Zurücksetzen.");
  }

  async function signInWithProvider(provider: OAuthProvider) {
    setBusy(true);
    setActiveProvider(provider);
    setError(null);
    setNotice(null);
    const result = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: oauthCallbackUrl(window.location.origin),
        scopes: provider === "google" ? "openid email profile" : "name email"
      }
    });
    if (result.error) {
      setBusy(false);
      setActiveProvider(null);
      setError("Die schnelle Anmeldung konnte nicht gestartet werden. Versuche es erneut oder nutze E-Mail.");
    }
  }

  const socialLoginEnabled = appleEnabled || googleEnabled;
  const showDemoEntry = demoEnabled && !socialLoginEnabled;
  const hasSimpleEntry = socialLoginEnabled || showDemoEntry;
  const isRecovery = screen === "recovery";

  return (
    <AuthFrame
      eyebrow={isRecovery ? "Passwort zurücksetzen" : "Geschützter Zugang"}
      title={isRecovery ? "Neuen Link anfordern" : "Einfach loslegen"}
      description={isRecovery
        ? "Wir senden dir nur dann einen Link, wenn zu der Adresse ein FoodOS-Konto gehört. Private Daten bleiben weiterhin durch 2FA geschützt."
        : showDemoEntry
          ? "Öffne die lokale Demo mit einem Tipp. Für ein persönliches Konto kannst du jederzeit E-Mail verwenden."
          : "Ein Tipp genügt. Beim ersten Mal schützt du dein Konto zusätzlich; danach bleibst du auf diesem Gerät angemeldet."}
    >
      {isRecovery ? (
        <form className="auth-form" onSubmit={requestPasswordReset} noValidate>
          <label>
            <span>E-Mail-Adresse</span>
            <div><AtSign size={18} aria-hidden="true" /><input name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          </label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {notice && <p className="auth-message success" role="status">{notice}</p>}
          <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}Link zum Zurücksetzen senden</button>
          <button className="privacy-text-button" type="button" disabled={busy} onClick={returnToCredentials}>Zurück zur Anmeldung</button>
          <p className="auth-flow-note">Meldest du dich nur mit Apple oder Google an, verwaltest du dein Passwort direkt bei diesem Anbieter.</p>
        </form>
      ) : <>
        {hasSimpleEntry && (
          <fieldset className="oauth-stack" aria-busy={busy || undefined}>
            <legend>{socialLoginEnabled ? "Mit einem Konto anmelden" : "FoodOS ausprobieren"}</legend>
            {showDemoEntry && (
              <button className="oauth-button demo" type="button" onClick={() => router.push("/?demo=1")}>
                <Play size={18} aria-hidden="true" /> FoodOS ausprobieren
              </button>
            )}
            {appleEnabled && (
              <button className="oauth-button apple" type="button" onClick={() => void signInWithProvider("apple")} disabled={busy}>
                <ProviderMark provider="apple" />
                {activeProvider === "apple" ? "Apple wird geöffnet …" : "Mit Apple fortfahren"}
              </button>
            )}
            {googleEnabled && (
              <button className="oauth-button google" type="button" onClick={() => void signInWithProvider("google")} disabled={busy}>
                <ProviderMark provider="google" />
                {activeProvider === "google" ? "Google wird geöffnet …" : "Mit Google fortfahren"}
              </button>
            )}
            {activeProvider && <p className="sr-only" role="status">{activeProvider === "apple" ? "Apple" : "Google"} wird geöffnet.</p>}
          </fieldset>
        )}
        {!socialLoginEnabled && <p className="auth-flow-note oauth-unavailable" role="status">Apple- und Google-Anmeldung stehen auf dieser FoodOS-Installation noch nicht zur Verfügung. Du kannst dich sicher mit E-Mail anmelden.</p>}
        {error && <p className="auth-message error auth-level-message" role="alert">{error}</p>}
        {notice && <p className="auth-message success auth-level-message" role="status">{notice}</p>}
        <details className="email-auth" open={!hasSimpleEntry}>
          <summary><Mail size={17} /> Mit E-Mail weitermachen</summary>
          <div className="email-auth-panel">
            <div className="auth-tabs" role="tablist" aria-label="E-Mail-Anmeldemodus">
              <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Anmelden</button>
              <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Neu hier</button>
            </div>
            <form className="auth-form" onSubmit={submit} noValidate>
              <label>
                <span>E-Mail-Adresse</span>
                <div><AtSign size={18} aria-hidden="true" /><input name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
              </label>
              <label>
                <span>Passwort</span>
                <div><KeyRound size={18} aria-hidden="true" /><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} maxLength={128} required /></div>
                {mode === "register" && <small>Mindestens 12 Zeichen. Verwende ein einzigartiges Passwort.</small>}
              </label>
              {mode === "login" && <button className="privacy-text-button forgot-password-button" type="button" onClick={() => { setScreen("recovery"); setError(null); setNotice(null); }}>Passwort vergessen?</button>}
              <button className="primary-button wide" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={17} />}
                {busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Konto erstellen"}
              </button>
            </form>
          </div>
        </details>
      </>}
      {onEditPrivacy && <button className="privacy-text-button auth-privacy-link" type="button" onClick={onEditPrivacy}>Datenschutz-Auswahl ändern</button>}
    </AuthFrame>
  );
}
