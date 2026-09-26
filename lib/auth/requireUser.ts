import "server-only";
import { jsonError, WRONG_DOMAIN_MESSAGE } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { storedUserSchema, type Role, type UserProfile } from "@/lib/validation/user";
import { isAllowedEmail, type Identity } from "./roles";

export type AuthResult<T> = { ok: true; value: T } | { ok: false; response: Response };

function fail(status: number, message: string): { ok: false; response: Response } {
  return { ok: false, response: jsonError(status, message) };
}

function bearerToken(request: Request): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1];
}

/**
 * Step 1 of SPEC.md §7.3: verify the Firebase ID token with the Admin SDK, then require a verified
 * email on ALLOWED_EMAIL_DOMAIN. Does not touch Firestore, so `/api/me` can use it before provisioning.
 */
export async function verifyIdentity(request: Request): Promise<AuthResult<Identity>> {
  const token = bearerToken(request);
  if (!token) return fail(401, "Please sign in.");

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch {
    return fail(401, "Your session has expired. Please sign in again.");
  }

  const email = decoded.email?.trim().toLowerCase();
  if (!email || decoded.email_verified !== true || !isAllowedEmail(email, getServerEnv().ALLOWED_EMAIL_DOMAIN)) {
    return fail(403, WRONG_DOMAIN_MESSAGE);
  }

  const name = typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : email.split("@")[0];
  return { ok: true, value: { uid: decoded.uid, email, name } };
}

/**
 * The one auth helper every API route uses (SPEC.md §7.3): verified token + domain, then the role from
 * `users/{uid}` (never from the client), then the role check.
 *
 *   const auth = await requireUser(request, ["mentor"]);
 *   if (!auth.ok) return auth.response;
 */
export async function requireUser(request: Request, roles: readonly Role[]): Promise<AuthResult<UserProfile>> {
  const identity = await verifyIdentity(request);
  if (!identity.ok) return identity;
  const { uid } = identity.value;

  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return fail(403, "Your account is not set up yet. Please sign in again.");

  const parsed = storedUserSchema.safeParse(snapshot.data());
  if (!parsed.success) {
    console.error(`users/${uid} does not match the user schema`);
    return fail(500, "Your account data is invalid. Please contact a mentor.");
  }

  if (!roles.includes(parsed.data.role)) return fail(403, "You do not have access to this.");
  return { ok: true, value: { uid, ...parsed.data } };
}
