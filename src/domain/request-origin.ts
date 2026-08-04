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
