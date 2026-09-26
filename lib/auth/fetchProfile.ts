import { z } from "zod";
import { storedUserSchema, type UserProfile } from "@/lib/validation/user";

const meResponseSchema = z.object({ profile: storedUserSchema.extend({ uid: z.string() }) });
const errorResponseSchema = z.object({ error: z.string() });

export type ProfileResult = { ok: true; profile: UserProfile } | { ok: false; status: number; message: string };

/** Calls `POST /api/me` (provisions on first login) and validates the reply. Never throws. */
export async function fetchProfile(idToken: string, fetchFn: typeof fetch = fetch): Promise<ProfileResult> {
  let response: Response;
  try {
    response = await fetchFn("/api/me", { method: "POST", headers: { authorization: `Bearer ${idToken}` } });
  } catch {
    return { ok: false, status: 0, message: "Could not reach the server. Check your connection and try again." };
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const parsed = meResponseSchema.safeParse(body);
    if (parsed.success) return { ok: true, profile: parsed.data.profile };
    return { ok: false, status: 500, message: "The server sent an unexpected reply. Please try again." };
  }

  const error = errorResponseSchema.safeParse(body);
  return {
    ok: false,
    status: response.status,
    message: error.success ? error.data.error : "Something went wrong. Please try again.",
  };
}
