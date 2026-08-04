import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRecoverySessionClaims } from "@/domain/auth-recovery";
import { PASSWORD_RESET_PATH, safeNonRecoveryNextPath } from "@/domain/auth-redirect";
import { publicRequestOrigin } from "@/domain/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectForRequest(request: Request, requestUrl: URL, destination: string): NextResponse {
  return NextResponse.redirect(new URL(destination, publicRequestOrigin(request) ?? requestUrl.origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (url.searchParams.has("error")) {
    return redirectForRequest(request, url, "/?auth_error=oauth");
  }

  const supabase = await createSupabaseServerClient();
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session?.access_token) {
      const claims = await supabase.auth.getClaims(data.session.access_token);
      const destination = !claims.error && isRecoverySessionClaims(claims.data?.claims)
        ? PASSWORD_RESET_PATH
        : safeNonRecoveryNextPath(url.searchParams.get("next"));
      return redirectForRequest(request, url, destination);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.session?.access_token) {
      const claims = await supabase.auth.getClaims(data.session.access_token);
      const destination = !claims.error && isRecoverySessionClaims(claims.data?.claims)
        ? PASSWORD_RESET_PATH
        : safeNonRecoveryNextPath(url.searchParams.get("next"));
      return redirectForRequest(request, url, destination);
    }
  }

  return redirectForRequest(request, url, type === "recovery" ? "/?auth_error=recovery" : "/?auth_error=confirmation");
}
