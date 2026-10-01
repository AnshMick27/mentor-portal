import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { storedUserSchema } from "@/lib/validation/user";

export type RemovalResult =
  | { ok: true; uid: string; removed: boolean }
  | { ok: false; status: 400 | 404; message: string };

const NOT_FOUND: RemovalResult = { ok: false, status: 404, message: "Student not found." };
const NOT_A_STUDENT: RemovalResult = { ok: false, status: 400, message: "Only student accounts can be removed or restored." };

/**
 * Removes (`removed: true`) or restores a STUDENT account in one transaction (T34a). The user doc stays, so the
 * next sign-in cannot re-create them as a fresh student; their submissions stay for the record. Removing also
 * deletes their `studentStats` so they leave dashboards and the leaderboard at once; the caller then runs a full
 * recompute so task stats follow. Repeating the same action is harmless.
 */
export async function setStudentRemoved(uid: string, removed: boolean, mentorUid: string): Promise<RemovalResult> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const statsRef = db.collection("studentStats").doc(uid);
  return db.runTransaction(async (tx): Promise<RemovalResult> => {
    const snapshot = await tx.get(userRef);
    if (!snapshot.exists) return NOT_FOUND;
    const parsed = storedUserSchema.safeParse(snapshot.data());
    if (!parsed.success) return NOT_FOUND;
    if (parsed.data.role !== "student") return NOT_A_STUDENT;

    const now = Timestamp.now();
    tx.update(
      userRef,
      removed ? { removed: true, removedAt: now, removedBy: mentorUid } : { removed: false, restoredAt: now, restoredBy: mentorUid },
    );
    if (removed) tx.delete(statsRef);
    return { ok: true, uid, removed };
  });
}
