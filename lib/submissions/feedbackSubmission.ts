import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import type { Feedback } from "@/lib/ai/feedback";
import { getAdminDb } from "@/lib/firebase/admin";
import { attemptsUsed, type SubmissionLike } from "@/lib/submissions/scoring";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import {
  storedSubmissionSchema,
  type FeedbackRequest,
  type SubmissionResult,
} from "@/lib/validation/submission";

export type StartResult =
  | { ok: true; submissionId: string; attempt: number }
  | { ok: false; status: number; message: string };

/** Shown to the student when the AI call fails; the details go to the server log only. */
export const AI_FAILED_MESSAGE =
  "We could not get AI feedback right now. This attempt was not counted — please try again in a few minutes.";

function refuse(status: number, message: string): StartResult {
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
 * Checks the task and the attempt limit, then creates `submissions/{id}` as `running`, all in ONE
 * transaction so two parallel submits cannot both take the last attempt (SPEC.md §7.8).
 */
export async function startFeedbackSubmission(uid: string, body: FeedbackRequest, now: Date): Promise<StartResult> {
  const db = getAdminDb();
  const taskRef = db.collection("tasks").doc(body.taskId);
  const ownSubmissions = db.collection("submissions").where("uid", "==", uid).where("taskId", "==", body.taskId);
  const submissionRef = db.collection("submissions").doc();

  return db.runTransaction(async (tx): Promise<StartResult> => {
    const [taskSnap, subsSnap] = await Promise.all([tx.get(taskRef), tx.get(ownSubmissions)]);
    const task = taskSnap.exists ? taskDocToDto(body.taskId, taskSnap.data()) : undefined;
    // A draft looks the same as a missing task, so students learn nothing about unpublished work.
    if (!task || task.status !== "published") return refuse(404, "Task not found.");
    if (task.type !== body.type) return refuse(400, "This task does not take this kind of submission.");
    if (now.getTime() > new Date(task.dueAt).getTime()) {
      return refuse(403, "The due date for this task has passed, so it no longer accepts submissions.");
    }

    const used = attemptsUsed(
      subsSnap.docs.flatMap((doc) => toSubmissionLike(doc.id, doc.data())),
      now,
    );
    if (used >= task.maxAttempts) {
      return refuse(409, `You have used all ${task.maxAttempts} attempts for this task.`);
    }

    const attempt = used + 1;
    tx.create(submissionRef, {
      taskId: body.taskId,
      uid,
      type: body.type,
      attempt,
      createdAt: Timestamp.fromDate(now),
      status: "running",
      content: body.content,
    });
    return { ok: true, submissionId: submissionRef.id, attempt };
  });
}

/** AI feedback → the stored `result` (SPEC.md §6). */
export function feedbackToResult(feedback: Feedback): SubmissionResult {
  const { score, summary, strengths, improvements, nextSteps, criteria } = feedback;
  return { score, summary, strengths, improvements, nextSteps, criteria };
}

/** Marks a running submission `done` with its result, or `error` with a plain-English message (not counted). */
export async function finishFeedbackSubmission(
  submissionId: string,
  outcome: { result: SubmissionResult } | { error: string },
): Promise<void> {
  const ref = getAdminDb().collection("submissions").doc(submissionId);
  await ref.update("result" in outcome ? { status: "done", result: outcome.result } : { status: "error", error: outcome.error });
}
