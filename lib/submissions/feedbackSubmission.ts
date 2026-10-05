import "server-only";
import type { Feedback } from "@/lib/ai/feedback";
import { getAdminDb } from "@/lib/firebase/admin";
import { startSubmission, type StartResult } from "@/lib/submissions/startSubmission";
import type { FeedbackRequest, StoredIntegrity, SubmissionResult } from "@/lib/validation/submission";

/** Shown to the student when the AI call fails; the details go to the server log only. */
export const AI_FAILED_MESSAGE =
  "We could not get AI feedback right now. This attempt was not counted — please try again in a few minutes.";

/** Checks the task and the attempt limit, then creates the submission as `running` (one transaction). */
export function startFeedbackSubmission(uid: string, body: FeedbackRequest, now: Date, integrity?: StoredIntegrity): Promise<StartResult> {
  const sub = { uid, taskId: body.taskId, type: body.type, status: "running", content: body.content, integrity } as const;
  return startSubmission(sub, now, () => ({ ok: true }));
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
