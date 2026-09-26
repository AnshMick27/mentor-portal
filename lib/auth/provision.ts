import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/config/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { storedUserSchema, type StoredUser, type UserProfile } from "@/lib/validation/user";
import { decideRole, planProvision, type Identity } from "./roles";

/**
 * Creates `users/{uid}` on first login or upgrades the role, inside a transaction so two parallel logins
 * cannot both create the doc. Call only with an identity from `verifyIdentity` (domain already checked).
 */
export async function provisionUser(identity: Identity): Promise<UserProfile> {
  const env = getServerEnv();
  const listRole = decideRole(identity.email, env.MENTOR_EMAILS, env.VIEWER_EMAILS);
  const db = getAdminDb();
  const ref = db.collection("users").doc(identity.uid);

  const user = await db.runTransaction(async (tx): Promise<StoredUser> => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists ? storedUserSchema.parse(snapshot.data()) : undefined;
    const plan = planProvision(existing, identity, listRole);

    if (plan.action === "create") tx.create(ref, { ...plan.user, createdAt: FieldValue.serverTimestamp() });
    if (plan.action === "update") tx.update(ref, plan.changes);
    return plan.user;
  });

  return { uid: identity.uid, ...user };
}
