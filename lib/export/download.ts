/** Fallback when the server's Content-Disposition is missing or odd. */
export const DEFAULT_EXPORT_FILENAME = "mentor-portal.xlsx";

/** `attachment; filename="x.xlsx"` → `x.xlsx`; only plain, safe names are accepted. */
export function filenameFromDisposition(header: string | null): string {
  const match = header?.match(/filename="([A-Za-z0-9._-]+\.xlsx)"/);
  return match?.[1] ?? DEFAULT_EXPORT_FILENAME;
}

export type DownloadResult = { ok: true; blob: Blob; filename: string } | { ok: false; message: string };

/**
 * GET /api/export with the user's ID token (a plain link can't send it). Never throws; errors come back as
 * the server's plain-English message.
 */
export async function fetchExport(
  getIdToken: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadResult> {
  let response: Response;
  try {
    const token = await getIdToken();
    if (!token) return { ok: false, message: "Please sign in again." };
    response = await fetchImpl("/api/export", { headers: { authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => undefined);
    const error = typeof data === "object" && data !== null ? Reflect.get(data, "error") : undefined;
    return { ok: false, message: typeof error === "string" ? error : "Could not build the export. Please try again." };
  }
  return { ok: true, blob: await response.blob(), filename: filenameFromDisposition(response.headers.get("content-disposition")) };
}
