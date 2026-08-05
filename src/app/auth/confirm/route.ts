import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRecoverySessionClaims } from "@/domain/auth-recovery";
import { PASSWORD_RESET_PATH, safeNonRecoveryNextPath } from "@/domain/auth-redirect";
import { authCallbackOriginForRequest } from "@/domain/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function authConfigurationUnavailable(): NextResponse {
  return new NextResponse("Der sichere Anmelderücksprung ist nicht konfiguriert.", {
    status: 503,
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

function redirectToOrigin(origin: string, destination: string): NextResponse {
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackOrigin = authCallbackOriginForRequest(request);
  if (!callbackOrigin) return authConfigurationUnavailable();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (url.searchParams.has("error")) {
    return redirectToOrigin(callbackOrigin, "/?auth_error=oauth");
  }

  const supabase = await createSupabaseServerClient();
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session?.access_token) {
      const claims = await supabase.auth.getClaims(data.session.access_token);
      const destination = !claims.error && isRecoverySessionClaims(claims.data?.claims)
        ? PASSWORD_RESET_PATH
        : safeNonRecoveryNextPath(url.searchParams.get("next"));
      return redirectToOrigin(callbackOrigin, destination);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.session?.access_token) {
      const claims = await supabase.auth.getClaims(data.session.access_token);
      const destination = !claims.error && isRecoverySessionClaims(claims.data?.claims)
        ? PASSWORD_RESET_PATH
        : safeNonRecoveryNextPath(url.searchParams.get("next"));
      return redirectToOrigin(callbackOrigin, destination);
    }
  }

  return redirectToOrigin(callbackOrigin, type === "recovery" ? "/?auth_error=recovery" : "/?auth_error=confirmation");
}
