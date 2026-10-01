import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { initialStudentStats } from "@/lib/stats/initialStudentStats";
import type { OnboardingInput } from "@/lib/validation/onboarding";
import { storedUserSchema, type UserProfile } from "@/lib/validation/user";

export type OnboardingResult = { ok: true; profile: UserProfile } | { ok: false; status: number; message: string };

/**
 * Saves roll number and branch, sets `onboarded: true` and creates `studentStats/{uid}`, all in one
 * transaction. Refuses a second onboarding and a roll number another account already uses.
 */
export async function completeOnboarding(uid: string, input: OnboardingInput): Promise<OnboardingResult> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const statsRef = db.collection("studentStats").doc(uid);
  const sameRollNo = db.collection("users").where("rollNo", "==", input.rollNo).limit(1);

  return db.runTransaction(async (tx): Promise<OnboardingResult> => {
    const [userSnap, rollNoSnap] = await Promise.all([tx.get(userRef), tx.get(sameRollNo)]);
    const user = storedUserSchema.parse(userSnap.data());
    if (user.onboarded) return { ok: false, status: 409, message: "Your profile is already complete." };
    if (rollNoSnap.docs.some((doc) => doc.id !== uid)) {
      return {
        ok: false,
        status: 409,
        message: "This roll number is already registered. Check it, or ask a mentor for help.",
      };
    }

    const changes = { rollNo: input.rollNo, branch: input.branch, onboarded: true };
    tx.update(userRef, changes);
    tx.set(statsRef, {
      ...initialStudentStats({ name: user.name, showOnLeaderboard: user.showOnLeaderboard, ...input }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, profile: { uid, ...user, ...changes } };
  });
}
