import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { attemptsUsed, type SubmissionLike } from "@/lib/submissions/scoring";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedSubmissionSchema } from "@/lib/validation/submission";
import type { Language, TaskDto, TaskType } from "@/lib/validation/task";

export type Refusal = { ok: false; status: number; message: string };

export type StartResult<T = object> = ({ ok: true; submissionId: string; attempt: number } & T) | Refusal;

export type NewSubmission = {
  uid: string;
  taskId: string;
  type: TaskType;
  /** `running` for AI feedback (the server works on it now), `queued` for the judge. */
  status: "queued" | "running";
  content: string;
  language?: Language;
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
 * Checks the task (published, right type, not past due, plus `check` for type-specific rules) and the attempt
 * limit, then creates `submissions/{id}`, all in ONE transaction so two parallel submits cannot both take the
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
    if (now.getTime() > new Date(task.dueAt).getTime()) {
      return refuse(403, "The due date for this task has passed, so it no longer accepts submissions.");
    }
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
    });
    return { ...extra, ok: true, submissionId: submissionRef.id, attempt };
  });
}
