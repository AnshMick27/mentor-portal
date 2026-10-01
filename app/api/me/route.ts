import { jsonError } from "@/lib/api/errors";
import { provisionUser } from "@/lib/auth/provision";
import { verifyIdentity } from "@/lib/auth/requireUser";

/** Called by the client right after Google sign-in: provisions `users/{uid}` and returns the profile. */
export async function POST(request: Request): Promise<Response> {
  const identity = await verifyIdentity(request);
  if (!identity.ok) return identity.response;

  try {
    const result = await provisionUser(identity.value);
    return result.ok ? Response.json({ profile: result.profile }) : jsonError(result.status, result.message);
  } catch (error) {
    console.error(`POST /api/me failed for uid ${identity.value.uid}:`, error);
    return jsonError(500, "Could not load your account. Please try again.");
  }
}
