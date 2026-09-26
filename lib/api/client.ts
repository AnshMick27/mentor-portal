export type ApiResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

type GetIdToken = () => Promise<string | null>;

/**
 * Browser → our API routes with `Authorization: Bearer <idToken>`. Never throws; errors come back as the
 * server's plain-English `{ error }` message. Callers validate `data` with zod.
 */
export async function apiFetch(
  getIdToken: GetIdToken,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<ApiResult> {
  let response: Response;
  try {
    const token = await getIdToken();
    if (!token) return { ok: false, status: 401, message: "Please sign in again." };
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    return { ok: false, status: 0, message: "Could not reach the server. Check your connection and try again." };
  }

  const data: unknown = await response.json().catch(() => undefined);
  if (response.ok) return { ok: true, data };
  const error = typeof data === "object" && data !== null ? Reflect.get(data, "error") : undefined;
  return {
    ok: false,
    status: response.status,
    message: typeof error === "string" ? error : "Something went wrong. Please try again.",
  };
}
