import { FoodOsApp } from "@/components/food-os-app";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { MfaGate } from "@/features/auth/mfa-gate";
import { OnboardingScreen } from "@/features/auth/onboarding-screen";
import { AuthFrame } from "@/features/auth/auth-frame";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadFoodOsSnapshot } from "@/infrastructure/foodos-repository";

// Authentication depends on request cookies and runtime deployment configuration.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) return <FoodOsApp preview />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <SignInScreen />;
  if (data.claims.aal !== "aal2") return <MfaGate />;

  const app = await loadFoodOsSnapshot(supabase);
  if (app.kind === "onboarding") return <OnboardingScreen />;
  if (app.kind === "error") {
    return <AuthFrame showSignOut eyebrow="Datenzugriff" title="FoodOS konnte nicht geladen werden" description={app.message}><p className="auth-message error" role="alert">Versuche es erneut. Bleibt der Fehler bestehen, nutze die sichere Referenz FOS-LOAD-PRIVATE.</p></AuthFrame>;
  }

  return <FoodOsApp authenticated initialSnapshot={app.snapshot} />;
}
