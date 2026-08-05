import { NextResponse } from "next/server";
import { isRecoverySessionClaims } from "@/domain/auth-recovery";
import { passwordResetSchema } from "@/domain/password";
import { hasSameConfiguredOrigin } from "@/domain/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number): Response {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

async function hasVerifiedRecoverySession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const claims = await supabase.auth.getClaims();
  return !claims.error && isRecoverySessionClaims(claims.data?.claims);
}

async function revokeAllSessions(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  try {
    const result = await supabase.auth.signOut({ scope: "global" });
    return !result.error;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasSameConfiguredOrigin(request)) return noStoreJson({ error: "INVALID_REQUEST_ORIGIN" }, 403);

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return noStoreJson({ error: "SERVICE_UNAVAILABLE" }, 503);
  }

  try {
    if (!(await hasVerifiedRecoverySession(supabase))) return noStoreJson({ error: "RECOVERY_REQUIRED" }, 401);
  } catch {
    return noStoreJson({ error: "RECOVERY_REQUIRED" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ error: "INVALID_REQUEST" }, 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return noStoreJson({ error: "INVALID_REQUEST" }, 400);

  const action = (payload as Record<string, unknown>).action;
  if (action === "revoke") {
    return (await revokeAllSessions(supabase))
      ? noStoreJson({ status: "complete" }, 200)
      : noStoreJson({ status: "password-updated-revocation-pending" }, 409);
  }

  if (action !== "reset") return noStoreJson({ error: "INVALID_REQUEST" }, 400);
  const parsed = passwordResetSchema.safeParse(payload);
  if (!parsed.success) return noStoreJson({ error: "INVALID_PASSWORD" }, 400);

  let updateError: unknown;
  try {
    ({ error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword }));
  } catch {
    return noStoreJson({ error: "PASSWORD_RESET_FAILED" }, 422);
  }
  if (updateError) return noStoreJson({ error: "PASSWORD_RESET_FAILED" }, 422);

  return (await revokeAllSessions(supabase))
    ? noStoreJson({ status: "complete" }, 200)
    : noStoreJson({ status: "password-updated-revocation-pending" }, 409);
}
