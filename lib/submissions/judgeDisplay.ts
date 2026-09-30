import { MAX_CODE_BYTES, utf8Bytes } from "@/lib/submissions/limits";
import { effectiveStatus, type SubmissionLike } from "@/lib/submissions/scoring";
import type { JudgeResult } from "@/lib/validation/submission";

/** SPEC.md §8.3 wording: "Wrong Answer on test 2", "Accepted", "Compilation Error", … */
export function verdictLabel(judge: Pick<JudgeResult, "verdict" | "firstFailedTest">): string {
  return judge.firstFailedTest === undefined ? judge.verdict : `${judge.verdict} on test ${judge.firstFailedTest}`;
}

export type JudgeStatusView = {
  /** Drives the colour: waiting (neutral), passed (green), failed (amber), error (not counted). */
  tone: "waiting" | "passed" | "failed" | "error";
  headline: string;
  detail?: string;
  compileOutput?: string;
};

type CodingSubmission = SubmissionLike & { result?: { score: number; judge?: JudgeResult } };

/** What the student sees for one coding attempt: queued → running → done, or not counted (incl. >10 min stuck). */
export function judgeStatusView(submission: CodingSubmission, now: Date): JudgeStatusView {
  const effective = effectiveStatus(submission, now);
  switch (effective.status) {
    case "queued":
      return { tone: "waiting", headline: "Waiting for the judge…", detail: "Your code is in the queue. This page updates by itself." };
    case "running":
      return { tone: "waiting", headline: "Running your code…", detail: "Checking it against the hidden tests." };
    case "error":
      return {
        tone: "error",
        headline: "Not counted",
        detail: `${effective.error ?? "Something went wrong."} You can try again.`,
      };
    case "done": {
      const judge = submission.result?.judge;
      if (!judge) return { tone: "failed", headline: "Checked" };
      return {
        tone: judge.verdict === "Accepted" ? "passed" : "failed",
        headline: verdictLabel(judge),
        detail: `Passed ${judge.passed} of ${judge.total} tests.`,
        ...(judge.compileOutput ? { compileOutput: judge.compileOutput } : {}),
      };
    }
  }
}

/** Spaces inserted by Tab in the code box. */
export const INDENT = "    ";

/** Replaces the selection with INDENT; returns the new text and where the cursor goes. */
export function insertIndent(value: string, selectionStart: number, selectionEnd: number) {
  const next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
  return { value: next, cursor: selectionStart + INDENT.length };
}

/** Byte counter against the 32 KB limit, e.g. "1.2 KB of 32 KB". */
export function codeSize(code: string): { text: string; tooBig: boolean } {
  const bytes = utf8Bytes(code);
  const kb = (bytes / 1024).toFixed(1);
  return { text: `${kb} KB of ${MAX_CODE_BYTES / 1024} KB`, tooBig: bytes > MAX_CODE_BYTES };
}
