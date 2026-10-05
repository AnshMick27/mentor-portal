import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { storedUserSchema } from "@/lib/validation/user";

export type ApprovalResult = { ok: true; uid: string } | { ok: false; status: 400 | 404; message: string };

/**
 * Approves a STUDENT waiting for a mentor (T48, SPEC.md §8.10): deletes `pendingApproval`, records who and when.
 * One transaction. Approving an approved student changes nothing; a removed student stays removed (restore is
 * separate). The caller recomputes stats afterwards so the student appears on the dashboards.
 */
export async function approveStudent(uid: string, mentorUid: string): Promise<ApprovalResult> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (tx): Promise<ApprovalResult> => {
    const snapshot = await tx.get(userRef);
    const parsed = snapshot.exists ? storedUserSchema.safeParse(snapshot.data()) : undefined;
    if (!parsed?.success) return { ok: false, status: 404, message: "Student not found." };
    if (parsed.data.role !== "student") return { ok: false, status: 400, message: "Only student accounts need approval." };
    if (parsed.data.pendingApproval === true) {
      tx.update(userRef, { pendingApproval: FieldValue.delete(), approvedAt: Timestamp.now(), approvedBy: mentorUid });
    }
    return { ok: true, uid };
  });
}
