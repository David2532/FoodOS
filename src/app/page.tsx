import { FoodOsApp } from "@/components/food-os-app";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { MfaGate } from "@/features/auth/mfa-gate";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Authentication depends on request cookies and runtime deployment configuration.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) return <FoodOsApp preview />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <SignInScreen />;
  if (data.claims.aal !== "aal2") return <MfaGate />;

  return <FoodOsApp authenticated />;
}
