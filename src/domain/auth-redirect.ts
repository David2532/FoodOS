const AUTH_REDIRECT_BASE = "https://foodos.invalid";

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

export function oauthCallbackUrl(origin: string, nextPath = "/"): string {
  const callback = new URL("/auth/confirm", origin);
  callback.searchParams.set("next", safeAuthNextPath(nextPath));
  return callback.toString();
}
