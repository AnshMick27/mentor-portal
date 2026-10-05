import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { refuse, type Refusal } from "@/lib/submissions/startSubmission";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { timestampLike } from "@/lib/validation/timestamp";

/** `drafts/{uid}_{taskId}` (SPEC.md §6, §8.9): server-only, so the server can measure how long an answer took. */
function draftRef(uid: string, taskId: string) {
  return getAdminDb().collection("drafts").doc(`${uid}_${taskId}`);
}

const draftSchema = z.object({ openedAt: timestampLike });

/** The form for a published code or intro task was opened: (re)start its clock. */
export async function openDraft(uid: string, taskId: string, now: Date): Promise<{ ok: true } | Refusal> {
  const snap = await getAdminDb().collection("tasks").doc(taskId).get();
  const task = snap.exists ? taskDocToDto(taskId, snap.data()) : undefined;
  // A draft looks the same as a missing task, as in startSubmission.
  if (!task || task.status !== "published") return refuse(404, "Task not found.");
  if (task.type === "resume") return refuse(400, "This task does not need a draft.");
  await draftRef(uid, taskId).set({ uid, taskId, openedAt: Timestamp.fromDate(now) });
  return { ok: true };
}

/** Milliseconds since the form was opened, or undefined when there is no (readable) draft. Never throws. */
export async function draftElapsedMs(uid: string, taskId: string, now: Date): Promise<number | undefined> {
  try {
    const snap = await draftRef(uid, taskId).get();
    const parsed = draftSchema.safeParse(snap.exists ? snap.data() : undefined);
    if (!parsed.success) return undefined;
    return Math.max(0, now.getTime() - parsed.data.openedAt.toDate().getTime());
  } catch (error) {
    console.error(`Could not read drafts/${uid}_${taskId}:`, error);
    return undefined;
  }
}
