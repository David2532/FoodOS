export interface RequestWindow {
  startedAt: number;
  count: number;
}

export function allowRequestInWindow(
  windows: Map<string, RequestWindow>,
  key: string,
  limit: number,
  now = Date.now(),
  windowMs = 60_000
): boolean {
  const boundedLimit = Math.max(1, Math.floor(limit));
  const current = windows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    windows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= boundedLimit) return false;
  current.count += 1;
  return true;
}
