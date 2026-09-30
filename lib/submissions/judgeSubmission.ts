import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { JudgeCallback } from "@/lib/judge/callbackPayload";
import { codingScore, effectiveStatus } from "@/lib/submissions/scoring";
import { refuse, startSubmission, type StartResult } from "@/lib/submissions/startSubmission";
import {
  storedSubmissionSchema,
  type CodeSubmitRequest,
  type JudgeResult,
  type SubmissionResult,
} from "@/lib/validation/submission";
import { LANGUAGE_LABEL } from "@/lib/validation/task";

/** Shown when GitHub would not start the judge; the details go to the server log only. */
export const DISPATCH_FAILED_MESSAGE =
  "We could not start the judge right now. This attempt was not counted — please try again in a few minutes.";

/** Stored when the judge itself reports an internal error; its own message goes to the server log only. */
export const JUDGE_FAILED_MESSAGE =
  "The judge had a problem running your code. This attempt was not counted — please try again.";

/**
 * Checks the coding task, the language and the attempt limit, then creates the submission as `queued`
 * (one transaction). Passes back the task's problem slug for the dispatch.
 */
export function startJudgeSubmission(
  uid: string,
  body: CodeSubmitRequest,
  now: Date,
): Promise<StartResult<{ problemSlug: string }>> {
  const sub = { uid, taskId: body.taskId, type: "coding", status: "queued", content: body.code, language: body.language } as const;
  return startSubmission(sub, now, (task) => {
    if (!task.coding) return refuse(500, "This coding task is not set up correctly. Please tell your mentor.");
    if (!task.coding.languages.includes(body.language)) {
      return refuse(400, `${LANGUAGE_LABEL[body.language]} is not allowed for this task.`);
    }
    return { ok: true, problemSlug: task.coding.problemSlug };
  });
}

/** Dispatch failed: the queued submission becomes `error` (not counted). */
export async function failJudgeDispatch(submissionId: string): Promise<void> {
  await getAdminDb().collection("submissions").doc(submissionId).update({ status: "error", error: DISPATCH_FAILED_MESSAGE });
}

/** Short plain-English summary of a judge result, e.g. "Wrong Answer on test 2: 1 of 3 tests passed." */
export function judgeSummary(judge: JudgeResult): string {
  const counts = `${judge.passed} of ${judge.total} tests passed.`;
  switch (judge.verdict) {
    case "Accepted":
      return `Accepted: all ${judge.total} tests passed.`;
    case "Compilation Error":
      return "Compilation Error: your code did not compile, so no tests were run.";
    default:
      return judge.firstFailedTest === undefined
        ? `${judge.verdict}: ${counts}`
        : `${judge.verdict} on test ${judge.firstFailedTest}: ${counts}`;
  }
}

/** A judge "done" callback → the stored `result` (SPEC.md §6). */
export function judgeToResult(payload: Extract<JudgeCallback, { status: "done" }>): SubmissionResult {
  const judge: JudgeResult = {
    ...payload.judge,
    ...(payload.compileOutput !== undefined ? { compileOutput: payload.compileOutput } : {}),
  };
  return {
    score: codingScore(judge.passed, judge.total),
    summary: judgeSummary(judge),
    strengths: [],
    improvements: [],
    nextSteps: [],
    judge,
  };
}

export type CallbackOutcome =
  | { ok: true; uid: string; taskId: string; status: "done" | "error" }
  | { ok: false; status: 409; message: string };

/**
 * Stores a verified judge callback, in one transaction. Only a coding submission that is still waiting
 * (`queued`/`running` and not past the 10-minute timeout) is changed: duplicate and late callbacks are
 * refused with 409 and change nothing, so a timed-out attempt the student was told "not counted" stays so.
 */
export async function applyJudgeCallback(payload: JudgeCallback, now: Date): Promise<CallbackOutcome> {
  const db = getAdminDb();
  const ref = db.collection("submissions").doc(payload.submissionId);

  return db.runTransaction(async (tx): Promise<CallbackOutcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, status: 409, message: "Unknown submission." };
    const parsed = storedSubmissionSchema.safeParse(snap.data());
    if (!parsed.success || parsed.data.type !== "coding") {
      return { ok: false, status: 409, message: "Not a coding submission." };
    }
    const { uid, taskId, status, createdAt } = parsed.data;
    const effective = effectiveStatus({ status, createdAt: createdAt.toDate() }, now).status;
    if (effective !== "queued" && effective !== "running") {
      return { ok: false, status: 409, message: "Submission is no longer waiting for the judge." };
    }

    if (payload.status === "error") {
      tx.update(ref, { status: "error", error: JUDGE_FAILED_MESSAGE });
      return { ok: true, uid, taskId, status: "error" };
    }
    tx.update(ref, { status: "done", result: judgeToResult(payload) });
    return { ok: true, uid, taskId, status: "done" };
  });
}
