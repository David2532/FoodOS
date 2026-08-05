import { FoodOsApp } from "@/components/food-os-app";
import { MfaGate } from "@/features/auth/mfa-gate";
import { OnboardingScreen } from "@/features/auth/onboarding-screen";
import { AuthFrame } from "@/features/auth/auth-frame";
import { EligibilityPrivacyGate } from "@/features/privacy/eligibility-privacy-gate";
import { PrivacyRecordGate } from "@/features/privacy/privacy-record-gate";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadFoodOsSnapshot } from "@/infrastructure/foodos-repository";
import { loadCurrentPrivacyChoices } from "@/infrastructure/privacy-repository";
import { redirect } from "next/navigation";
import { isBillingLabEnvironment } from "@/domain/entitlements";

// Authentication depends on request cookies and runtime deployment configuration.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ auth_error?: string | string[]; code?: string | string[]; demo?: string | string[] }> }) {
  const params = await searchParams;
  // Supabase falls back to the Site URL when a hosted redirect allowlist is stale.
  // Keep this compatibility hop narrow: only an OAuth code is forwarded to the
  // server-side PKCE exchange route; no arbitrary path or query string is retained.
  if (typeof params.code === "string" && params.code.length > 0) {
    redirect(`/auth/confirm?code=${encodeURIComponent(params.code)}`);
  }
  const demoEnabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true";
  const billingLabAvailable = isBillingLabEnvironment(process.env);
  const supabaseConfigured = isSupabaseConfigured();
  if (demoEnabled && params.demo === "1") return <FoodOsApp preview authEntryAvailable={supabaseConfigured} billingLabAvailable={billingLabAvailable} />;
  if (!supabaseConfigured) return <FoodOsApp preview billingLabAvailable={billingLabAvailable} />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const authError = params.auth_error;
    return (
      <EligibilityPrivacyGate
        authError={typeof authError === "string" ? authError : undefined}
        appleEnabled={process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === "true"}
        demoEnabled={demoEnabled}
        googleEnabled={process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === "true"}
      />
    );
  }
  if (data.claims.aal !== "aal2") return <MfaGate />;

  const privacy = await loadCurrentPrivacyChoices(supabase);
  if (privacy.kind === "required") return <PrivacyRecordGate />;
  if (privacy.kind === "error") return <AuthFrame showSignOut eyebrow="Datenschutz" title="Auswahl nicht verfügbar" description={privacy.message}><p className="auth-message error" role="alert">Lade die Seite neu. Private Haushaltsdaten bleiben bis zur erfolgreichen Prüfung geschlossen.</p></AuthFrame>;

  const app = await loadFoodOsSnapshot(supabase);
  if (app.kind === "onboarding") return <OnboardingScreen />;
  if (app.kind === "error") {
    return <AuthFrame showSignOut eyebrow="Datenzugriff" title="FoodOS konnte nicht geladen werden" description={app.message}><p className="auth-message error" role="alert">Versuche es erneut. Bleibt der Fehler bestehen, nutze die sichere Referenz FOS-LOAD-PRIVATE.</p></AuthFrame>;
  }

  return <FoodOsApp authenticated billingLabAvailable={billingLabAvailable} accountEmail={typeof data.claims.email === "string" ? data.claims.email : undefined} initialPrivacyChoices={privacy.choices} initialSnapshot={app.snapshot} />;
}
