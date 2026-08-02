"use client";

import { useState, type FormEvent } from "react";
import { Copy, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AuthFrame } from "./auth-frame";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MfaEnrollmentScreen({ loading = false, initialError }: { loading?: boolean; initialError?: string }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function begin() {
    setBusy(true);
    setError(null);
    const result = await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "FoodOS Authenticator" });
    setBusy(false);
    if (result.error) {
      setError("2FA konnte nicht vorbereitet werden. Lade die Seite neu und versuche es erneut.");
      return;
    }
    setEnrollment({ factorId: result.data.id, qrCode: result.data.totp.qr_code, secret: result.data.totp.secret });
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
    router.refresh();
  }

  return (
    <AuthFrame showSignOut eyebrow="Schritt 2 von 2" title="2FA aktivieren" description="FoodOS verlangt einen zweiten Faktor, bevor persönliche Vorrats- und Ernährungsdaten geöffnet werden.">
      {!enrollment ? (
        <div className="mfa-intro">
          <span><ShieldCheck size={26} /></span>
          <h2>Authenticator-App verbinden</h2>
          <p>Geeignet sind zum Beispiel 2FAS, Aegis, Google Authenticator oder Microsoft Authenticator.</p>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button className="primary-button wide" onClick={begin} disabled={busy || loading}>
            {(busy || loading) && <LoaderCircle className="spin" size={17} />}
            {loading ? "2FA-Status wird geprüft …" : "QR-Code erzeugen"}
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={verify}>
          <div className="mfa-qr">
            {/* Supabase returns a data URL containing its generated SVG. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="QR-Code zum Einrichten von FoodOS in einer Authenticator-App" />
          </div>
          <div className="mfa-secret">
            <span><QrCode size={16} /> Manuell eintragen</span>
            <code>{enrollment.secret}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(enrollment.secret)}><Copy size={15} /> Kopieren</button>
          </div>
          <label>
            <span>Sechsstelliger Code</span>
            <div><ShieldCheck size={18} /><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></div>
          </label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <button className="primary-button wide" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}2FA bestätigen</button>
        </form>
      )}
    </AuthFrame>
  );
}
