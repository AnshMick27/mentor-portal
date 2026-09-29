import "server-only";

export type FinishedSubmission = { submissionId: string; uid: string; taskId: string };

/**
 * Called once after every submission reaches a final state (`done` or `error`), by `/api/feedback` and
 * the judge callback. A no-op for now: Loop 3 recomputes `studentStats` and `taskStats` here (SPEC.md §8.7).
 */
export async function onFinished(submission: FinishedSubmission): Promise<void> {
  void submission;
}
