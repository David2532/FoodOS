const AUTH_REDIRECT_BASE = "https://foodos.invalid";
export const PASSWORD_RESET_PATH = "/auth/passwort-zuruecksetzen";

export function safeAuthNextPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\r\n]/.test(candidate)) return "/";
  try {
    const parsed = new URL(candidate, AUTH_REDIRECT_BASE);
    if (parsed.origin !== AUTH_REDIRECT_BASE) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

/** Password recovery has its own server-verified admission check. */
export function safeNonRecoveryNextPath(candidate: string | null | undefined): string {
  const safePath = safeAuthNextPath(candidate);
  const pathname = new URL(safePath, AUTH_REDIRECT_BASE).pathname;
  return pathname === PASSWORD_RESET_PATH ? "/" : safePath;
}

export function oauthCallbackUrl(origin: string, nextPath = "/"): string {
  const callback = new URL("/auth/confirm", origin);
  callback.searchParams.set("next", safeAuthNextPath(nextPath));
  return callback.toString();
}
