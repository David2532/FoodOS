function singleForwardedHeader(request: Request, name: string): string | null | undefined {
  const rawValue = request.headers.get(name);
  if (rawValue === null) return undefined;
  const value = rawValue.trim();
  return value && !value.includes(",") ? value : null;
}

function httpOrigin(protocol: string | undefined, host: string | undefined): string | null {
  if (!protocol || !host || (protocol !== "http" && protocol !== "https") || /[\s/@?#\\]/.test(host)) return null;
  try {
    const url = new URL(protocol + "://" + host);
    return url.hostname ? url.origin : null;
  } catch {
    return null;
  }
}

function requestUrlOrigin(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return httpOrigin(url.protocol.slice(0, -1), url.host);
  } catch {
    return null;
  }
}

/**
 * Resolves the public origin without reflecting malformed forwarding headers.
 * A valid Host takes precedence over a standalone server's internally rebuilt URL.
 */
export function publicRequestOrigin(request: Request): string | null {
  const fallback = requestUrlOrigin(request);
  const forwardedHost = singleForwardedHeader(request, "x-forwarded-host");
  const forwardedProtocol = singleForwardedHeader(request, "x-forwarded-proto");
  if (forwardedHost === null || forwardedProtocol === null) return fallback;

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return null;
  }

  const host = forwardedHost ?? request.headers.get("host")?.trim() ?? requestUrl.host;
  const protocol = forwardedProtocol ?? requestUrl.protocol.slice(0, -1);
  return httpOrigin(protocol, host) ?? fallback;
}

/**
 * State-changing routes use an environment-owned origin, never request headers, as
 * their CSRF boundary. A missing or malformed configuration fails closed.
 */
export function configuredApplicationOrigin(): string | null {
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
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function hasSameConfiguredOrigin(request: Request): boolean {
  const originValue = request.headers.get("origin");
  if (!originValue) return false;
  let origin: URL;
  try {
    origin = new URL(originValue);
  } catch {
    return false;
  }
  return origin.origin === originValue && origin.origin === configuredApplicationOrigin();
}
