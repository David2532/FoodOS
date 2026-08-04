import { redirect } from "next/navigation";
import { isRecoverySessionClaims } from "@/domain/auth-recovery";
import { PasswordResetScreen } from "@/features/auth/password-reset-screen";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PasswordResetPage() {
  if (!isSupabaseConfigured()) redirect("/?auth_error=recovery");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !isRecoverySessionClaims(data?.claims)) redirect("/?auth_error=recovery");
  return <PasswordResetScreen />;
}
