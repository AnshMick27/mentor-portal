import { describe, expect, it } from "vitest";
import { JUDGE_TIMEOUT_MS, TIMED_OUT_ERROR } from "@/lib/submissions/limits";
import { attemptsUsed, bestScore, codingScore, effectiveStatus, type SubmissionLike } from "@/lib/submissions/scoring";

const now = new Date("2026-10-01T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

function sub(status: SubmissionLike["status"], ageMs = 0, score?: number): SubmissionLike {
  return { status, createdAt: ago(ageMs), ...(score === undefined ? {} : { result: { score } }) };
}

describe("effectiveStatus", () => {
  it("keeps queued/running for exactly 10 minutes, then reports a timed-out error", () => {
    for (const status of ["queued", "running"] as const) {
      expect(effectiveStatus(sub(status, JUDGE_TIMEOUT_MS), now)).toEqual({ status });
      expect(effectiveStatus(sub(status, JUDGE_TIMEOUT_MS + 1), now)).toEqual({
        status: "error",
        error: TIMED_OUT_ERROR,
      });
    }
  });

  it("never changes done or error, however old", () => {
    expect(effectiveStatus(sub("done", JUDGE_TIMEOUT_MS * 10, 8), now)).toEqual({ status: "done" });
    const failed = { ...sub("error", JUDGE_TIMEOUT_MS * 10), error: "AI unavailable" };
    expect(effectiveStatus(failed, now)).toEqual({ status: "error", error: "AI unavailable" });
  });
});

describe("attemptsUsed", () => {
  it("counts done, queued and running, but not errors or timed-out submissions", () => {
    const subs = [
      sub("done", 0, 6),
      sub("queued", 60_000),
      sub("running", JUDGE_TIMEOUT_MS),
      sub("error"),
      sub("queued", JUDGE_TIMEOUT_MS + 1),
    ];
    expect(attemptsUsed(subs, now)).toBe(3);
    expect(attemptsUsed([], now)).toBe(0);
  });
});

describe("bestScore", () => {
  it("takes the highest score among finished submissions", () => {
    expect(bestScore([sub("done", 0, 4.5), sub("done", 0, 8.2), sub("done", 0, 7)])).toBe(8.2);
  });

  it("ignores unfinished and failed submissions, and is undefined when nothing is finished", () => {
    const failed = { ...sub("error"), result: { score: 10 } };
    expect(bestScore([sub("done", 0, 3), failed, sub("queued")])).toBe(3);
    expect(bestScore([sub("queued"), sub("error")])).toBeUndefined();
    expect(bestScore([])).toBeUndefined();
  });

  it("counts a score of 0 as a finished result", () => {
    expect(bestScore([sub("done", 0, 0)])).toBe(0);
  });
});

describe("codingScore", () => {
  it("is 10 × passed / total, rounded to one decimal", () => {
    expect(codingScore(3, 3)).toBe(10);
    expect(codingScore(0, 5)).toBe(0);
    expect(codingScore(1, 3)).toBe(3.3);
    expect(codingScore(2, 3)).toBe(6.7);
    expect(codingScore(1, 8)).toBe(1.3); // 1.25 rounds half up
    expect(codingScore(7, 9)).toBe(7.8);
  });

  it("refuses impossible counts, including total = 0", () => {
    expect(() => codingScore(0, 0)).toThrow(RangeError);
    expect(() => codingScore(4, 3)).toThrow(RangeError);
    expect(() => codingScore(-1, 3)).toThrow(RangeError);
    expect(() => codingScore(1.5, 3)).toThrow(RangeError);
  });
});
