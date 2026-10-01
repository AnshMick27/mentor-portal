import "server-only";
import { recomputeStudent, recomputeTask } from "@/lib/stats/recompute";

export type FinishedSubmission = { submissionId: string; uid: string; taskId: string };

/**
 * Called once after every submission reaches a final state (`done` or `error`), by `/api/feedback` and
 * the judge routes: recomputes that student's `studentStats` and that task's `taskStats` (SPEC.md §8.7).
 * Never throws: a failed recompute is logged and fixed by the next one (or the nightly cron).
 */
export async function onFinished(submission: FinishedSubmission): Promise<void> {
  const results = await Promise.allSettled([recomputeStudent(submission.uid), recomputeTask(submission.taskId)]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`Stats recompute failed after submissions/${submission.submissionId}:`, result.reason);
    }
  }
}
