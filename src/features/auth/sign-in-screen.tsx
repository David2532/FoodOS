"use client";

import { useState, type FormEvent } from "react";
import { AtSign, KeyRound, LoaderCircle, Mail, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { oauthCallbackUrl } from "@/domain/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

const credentialsSchema = z.object({
  email: z.email("Gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.").max(128)
});

type Mode = "login" | "register";
type OAuthProvider = "apple" | "google";

const authErrorMessages: Record<string, string> = {
  oauth: "Die Anmeldung beim Identitätsanbieter wurde abgebrochen oder abgelehnt. Versuche es erneut.",
  confirmation: "Der Anmeldelink ist ungültig oder abgelaufen. Starte die Anmeldung erneut."
};

export function SignInScreen({
  authError,
  appleEnabled = false,
  demoEnabled = false,
  googleEnabled = false
}: {
  authError?: string;
  appleEnabled?: boolean;
  demoEnabled?: boolean;
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(authError ? authErrorMessages[authError] ?? "Die Anmeldung konnte nicht bestätigt werden." : null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüfe deine Eingaben.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword(parsed.data)
      : await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
        });
    setBusy(false);

    if (result.error) {
      setError(mode === "login"
        ? "Anmeldung fehlgeschlagen. Prüfe E-Mail, Passwort und die E-Mail-Bestätigung."
        : result.error.message);
      return;
    }

    if (mode === "register" && !result.data.session) {
      setNotice("Konto angelegt. Bestätige jetzt den Link in deiner E-Mail.");
      return;
    }

    router.refresh();
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

  return (
    <AuthFrame
      eyebrow="Geschützter Zugang"
      title="Einfach loslegen"
      description={showDemoEntry
        ? "Öffne die lokale Demo mit einem Tipp. Für ein persönliches Konto kannst du jederzeit E-Mail verwenden."
        : "Ein Tipp genügt. Beim ersten Mal schützt du dein Konto zusätzlich; danach bleibst du auf diesem Gerät angemeldet."}
    >
      <div className="oauth-stack" aria-label="Schnelle Anmeldung">
        {showDemoEntry && (
          <button className="oauth-button demo" type="button" onClick={() => router.push("/?demo=1")}>
            <Play size={18} aria-hidden="true" /> FoodOS ausprobieren
          </button>
        )}
        {appleEnabled && (
          <button className="oauth-button apple" type="button" onClick={() => void signInWithProvider("apple")} disabled={busy}>
            <span className="provider-mark" aria-hidden="true">A</span>
            {activeProvider === "apple" ? "Apple wird geöffnet …" : "Mit Apple fortfahren"}
          </button>
        )}
        {googleEnabled && (
          <button className="oauth-button google" type="button" onClick={() => void signInWithProvider("google")} disabled={busy}>
            <span className="provider-mark" aria-hidden="true">G</span>
            {activeProvider === "google" ? "Google wird geöffnet …" : "Mit Google fortfahren"}
          </button>
        )}
      </div>
      {error && <p className="auth-message error auth-level-message" role="alert">{error}</p>}
      {notice && <p className="auth-message success auth-level-message" role="status">{notice}</p>}
      <details className="email-auth" open={!hasSimpleEntry}>
        <summary><Mail size={17} /> Mit E-Mail weitermachen</summary>
        <div className="email-auth-panel">
          <div className="auth-tabs" role="tablist" aria-label="E-Mail-Anmeldemodus">
            <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Anmelden</button>
            <button role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Neu hier</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label>
              <span>E-Mail-Adresse</span>
              <div><AtSign size={18} /><input name="email" type="email" autoComplete="email" inputMode="email" required /></div>
            </label>
            <label>
              <span>Passwort</span>
              <div><KeyRound size={18} /><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} required /></div>
              {mode === "register" && <small>Mindestens 10 Zeichen. Verwende ein einzigartiges Passwort.</small>}
            </label>
            <button className="primary-button wide" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>
        </div>
      </details>
    </AuthFrame>
  );
}
