export function isPublicCatalogPreviewRequest(requestUrl: string): boolean {
  const previewRequested = new URL(requestUrl).searchParams.get("preview") === "1";
  if (!previewRequested) return false;

  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true";
}
