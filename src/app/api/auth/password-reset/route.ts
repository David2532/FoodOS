import { NextResponse } from "next/server";
import { isRecoverySessionClaims } from "@/domain/auth-recovery";
import { passwordResetSchema } from "@/domain/password";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number): Response {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

/**
 * Returns the server-owned public origin for state-changing browser requests.
 * Request Host and forwarding headers remain untrusted input and must never decide
 * whether a password-changing request passes the CSRF boundary.
 */
function configuredApplicationOrigin(): string | null {
  const configured = process.env.FOODOS_APP_ORIGIN?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "" && url.pathname !== "/")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function hasSameOrigin(request: Request): boolean {
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return false;

  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return false;
  }
  if (origin.origin !== rawOrigin) return false;

  const expectedOrigin = configuredApplicationOrigin();
  return expectedOrigin !== null && origin.origin === expectedOrigin;
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
  if (!hasSameOrigin(request)) return noStoreJson({ error: "INVALID_REQUEST_ORIGIN" }, 403);

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
