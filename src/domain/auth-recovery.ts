import type { JwtPayload } from "@supabase/supabase-js";

type RecoverySessionClaims = Pick<JwtPayload, "amr" | "session_id" | "sub">;

function isRecoveryMethod(value: unknown): boolean {
  if (value === "recovery") return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "method" in value && value.method === "recovery";
}

/**
 * This must only receive claims returned by Supabase `auth.getClaims()`, which
 * verifies the JWT signature. The session id prevents a copied AMR fragment
 * from being treated as a usable reset session.
 */
export function isRecoverySessionClaims(claims: RecoverySessionClaims | null | undefined): boolean {
  return Boolean(
    claims
    && typeof claims.sub === "string"
    && claims.sub.length > 0
    && typeof claims.session_id === "string"
    && claims.session_id.length > 0
    && Array.isArray(claims.amr)
    && claims.amr.some(isRecoveryMethod)
  );
}
