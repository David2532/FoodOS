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

function normalizedApplicationOrigin(value: string | null | undefined): string | null {
  const configured = value?.trim();
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

function isLoopbackOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
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
  return normalizedApplicationOrigin(process.env.FOODOS_APP_ORIGIN);
}

/**
 * Auth callbacks use the deployment-owned origin in production. The only fallback is
 * an explicit loopback origin for local development and tests; arbitrary request or
 * proxy hosts are never promoted to a production redirect target.
 */
export function authCallbackOriginForRequest(request: Request): string | null {
  const configured = configuredApplicationOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;

  const publicOrigin = publicRequestOrigin(request);
  if (isLoopbackOrigin(publicOrigin)) return publicOrigin;
  const directOrigin = requestUrlOrigin(request);
  return isLoopbackOrigin(directOrigin) ? directOrigin : null;
}

/**
 * Browser auth initiators receive the canonical origin from the server. A browser-
 * derived value is accepted only for a loopback development session.
 */
export function authCallbackOriginForBrowser(
  configuredOrigin: string | null | undefined,
  browserOrigin: string
): string | null {
  const configured = normalizedApplicationOrigin(configuredOrigin);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  const localOrigin = normalizedApplicationOrigin(browserOrigin);
  return isLoopbackOrigin(localOrigin) ? localOrigin : null;
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
