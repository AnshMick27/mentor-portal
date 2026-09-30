// Relative `.ts` import so plain Node (the seed script) can load this file via lib/stats/compute.ts.
import { JUDGE_TIMEOUT_MS, TIMED_OUT_ERROR } from "./limits.ts";
import type { SubmissionStatus } from "@/lib/validation/submission";

/** The fields these helpers need; works for stored docs (after `toDate()`) and API replies alike. */
export type SubmissionLike = {
  status: SubmissionStatus;
  createdAt: Date;
  result?: { score: number };
  error?: string;
};

export type EffectiveStatus = { status: SubmissionStatus; error?: string };

/**
 * SPEC.md §9.5: a submission still `queued`/`running` MORE than 10 minutes after it was created is treated
 * as `error` ("Judge timed out, attempt not counted"). Everything else keeps its stored status.
 */
export function effectiveStatus(submission: SubmissionLike, now: Date): EffectiveStatus {
  const pending = submission.status === "queued" || submission.status === "running";
  if (pending && now.getTime() - submission.createdAt.getTime() > JUDGE_TIMEOUT_MS) {
    return { status: "error", error: TIMED_OUT_ERROR };
  }
  return submission.error === undefined
    ? { status: submission.status }
    : { status: submission.status, error: submission.error };
}

/** Attempts that count towards `maxAttempts`: every submission except errors (incl. timed-out ones). */
export function attemptsUsed(submissions: readonly SubmissionLike[], now: Date): number {
  return submissions.filter((submission) => effectiveStatus(submission, now).status !== "error").length;
}

/** SPEC.md §6: the best score across a student's finished attempts, or undefined if none is finished. */
export function bestScore(submissions: readonly SubmissionLike[]): number | undefined {
  let best: number | undefined;
  for (const submission of submissions) {
    if (submission.status !== "done" || submission.result === undefined) continue;
    if (best === undefined || submission.result.score > best) best = submission.result.score;
  }
  return best;
}

/** SPEC.md §6: `round(10 * passed / total, 1)`. Throws on impossible counts (e.g. `total = 0`). */
export function codingScore(passed: number, total: number): number {
  if (!Number.isInteger(passed) || !Number.isInteger(total) || total < 1 || passed < 0 || passed > total) {
    throw new RangeError(`Invalid judge counts: passed=${passed}, total=${total}`);
  }
  // 100 * passed / total is "score × 10"; rounding it keeps one decimal without float drift in the ×10 step.
  return Math.round((100 * passed) / total) / 10;
}
