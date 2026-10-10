import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { attemptsUsed, type SubmissionLike } from "@/lib/submissions/scoring";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedSubmissionSchema, type StoredIntegrity } from "@/lib/validation/submission";
import { closedMessage } from "@/lib/submissions/availability";
import { lateCutoff, type Language, type TaskDto, type TaskType } from "@/lib/validation/task";

export type Refusal = { ok: false; status: number; message: string };

/** `late`: sent after the due date (T44); the attempt is stored and gets feedback, but never counts for score. */
export type StartResult<T = object> = ({ ok: true; submissionId: string; attempt: number; late: boolean } & T) | Refusal;

export type NewSubmission = {
  uid: string;
  taskId: string;
  type: TaskType;
  /** `running` for AI feedback (the server works on it now), `queued` for the judge. */
  status: "queued" | "running";
  content: string;
  language?: Language;
  /** Code and intro only (SPEC.md §8.9). */
  integrity?: StoredIntegrity;
};

export function refuse(status: number, message: string): Refusal {
  return { ok: false, status, message };
}

/** Stored submission docs → the fields `attemptsUsed` needs. Malformed docs are logged and skipped. */
function toSubmissionLike(id: string, data: unknown): SubmissionLike[] {
  const parsed = storedSubmissionSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`submissions/${id} does not match the submission schema`);
    return [];
  }
  const { status, createdAt, result, error } = parsed.data;
  return [{ status, createdAt: createdAt.toDate(), ...(result ? { result } : {}), ...(error ? { error } : {}) }];
}

/**
 * Checks the task (published, right type, plus `check` for type-specific rules) and the attempt limit, marks the
 * attempt `late` when it is past the due date (SPEC.md §8.2: accepted, feedback only, never scored) and refuses it
 * once late work has closed (`lateCutoff`, T49), then creates `submissions/{id}`, all in ONE transaction so two parallel submits cannot both take the
 * last attempt (SPEC.md §7.8). `check` returns a refusal, or `{ ok: true, ...extra }` with fields to pass back.
 */
export async function startSubmission<T extends object>(
  sub: NewSubmission,
  now: Date,
  check: (task: TaskDto) => Refusal | ({ ok: true } & T),
): Promise<StartResult<T>> {
  const db = getAdminDb();
  const taskRef = db.collection("tasks").doc(sub.taskId);
  const ownSubmissions = db.collection("submissions").where("uid", "==", sub.uid).where("taskId", "==", sub.taskId);
  const submissionRef = db.collection("submissions").doc();

  return db.runTransaction(async (tx): Promise<StartResult<T>> => {
    const [taskSnap, subsSnap] = await Promise.all([tx.get(taskRef), tx.get(ownSubmissions)]);
    const task = taskSnap.exists ? taskDocToDto(sub.taskId, taskSnap.data()) : undefined;
    // A draft looks the same as a missing task, so students learn nothing about unpublished work.
    if (!task || task.status !== "published") return refuse(404, "Task not found.");
    if (task.type !== sub.type) return refuse(400, "This task does not take this kind of submission.");
    const late = now.getTime() > new Date(task.dueAt).getTime();
    if (now.getTime() > lateCutoff(task)) return refuse(409, closedMessage(task));
    const extra = check(task);
    if (!extra.ok) return extra;

    const used = attemptsUsed(
      subsSnap.docs.flatMap((doc) => toSubmissionLike(doc.id, doc.data())),
      now,
    );
    if (used >= task.maxAttempts) {
      return refuse(409, `You have used all ${task.maxAttempts} attempts for this task.`);
    }

    const attempt = used + 1;
    tx.create(submissionRef, {
      taskId: sub.taskId,
      uid: sub.uid,
      type: sub.type,
      attempt,
      createdAt: Timestamp.fromDate(now),
      status: sub.status,
      content: sub.content,
      ...(sub.language ? { language: sub.language } : {}),
      ...(late ? { late: true } : {}),
      ...(sub.integrity ? { integrity: sub.integrity } : {}),
    });
    return { ...extra, ok: true, submissionId: submissionRef.id, attempt, late };
  });
}
