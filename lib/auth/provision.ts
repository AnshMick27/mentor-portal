import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/config/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { REMOVED_MESSAGE } from "@/lib/api/errors";
import { storedUserSchema, type StoredUser, type UserProfile } from "@/lib/validation/user";
import { decideRole, planProvision, type Identity } from "./roles";

export type ProvisionResult = { ok: true; profile: UserProfile } | { ok: false; status: 403; message: string };

/**
 * Creates `users/{uid}` on first login or upgrades the role, inside a transaction so two parallel logins
 * cannot both create the doc. Call only with an identity from `verifyIdentity` (domain already checked).
 * A user a mentor removed stays removed: nothing is created or changed, and the caller gets a 403.
 */
export async function provisionUser(identity: Identity): Promise<ProvisionResult> {
  const env = getServerEnv();
  const listRole = decideRole(identity.email, env.MENTOR_EMAILS, env.VIEWER_EMAILS);
  const db = getAdminDb();
  const ref = db.collection("users").doc(identity.uid);

  const user = await db.runTransaction(async (tx): Promise<StoredUser | "removed"> => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists ? storedUserSchema.parse(snapshot.data()) : undefined;
    if (existing?.removed === true) return "removed";
    const plan = planProvision(existing, identity, listRole);

    if (plan.action === "create") tx.create(ref, { ...plan.user, createdAt: FieldValue.serverTimestamp() });
    if (plan.action === "update") tx.update(ref, plan.changes);
    return plan.user;
  });

  if (user === "removed") return { ok: false, status: 403, message: REMOVED_MESSAGE };
  return { ok: true, profile: { uid: identity.uid, ...user } };
}
