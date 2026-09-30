import { describe, expect, it } from "vitest";
import { codeSize, INDENT, insertIndent, judgeStatusView, verdictLabel } from "@/lib/submissions/judgeDisplay";
import { MAX_CODE_BYTES, TIMED_OUT_ERROR } from "@/lib/submissions/limits";
import type { JudgeResult } from "@/lib/validation/submission";

const now = new Date("2026-10-01T12:00:00Z");
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

function done(judge: JudgeResult, score = 5) {
  return {
    status: "done" as const,
    createdAt: minutesAgo(1),
    result: { score, summary: "", strengths: [], improvements: [], nextSteps: [], judge },
  };
}

describe("verdictLabel", () => {
  it("adds the failing test number when there is one", () => {
    expect(verdictLabel({ verdict: "Wrong Answer", firstFailedTest: 2 })).toBe("Wrong Answer on test 2");
    expect(verdictLabel({ verdict: "Time Limit Exceeded", firstFailedTest: 1 })).toBe("Time Limit Exceeded on test 1");
    expect(verdictLabel({ verdict: "Accepted" })).toBe("Accepted");
    expect(verdictLabel({ verdict: "Compilation Error" })).toBe("Compilation Error");
  });
});

describe("judgeStatusView", () => {
  it("shows queued and running as waiting", () => {
    expect(judgeStatusView({ status: "queued", createdAt: minutesAgo(1) }, now)).toMatchObject({
      tone: "waiting",
      headline: "Waiting for the judge…",
    });
    expect(judgeStatusView({ status: "running", createdAt: minutesAgo(9) }, now)).toMatchObject({
      tone: "waiting",
      headline: "Running your code…",
    });
  });

  it("shows an attempt stuck more than 10 minutes as timed out, not counted", () => {
    const exactly10 = judgeStatusView({ status: "queued", createdAt: minutesAgo(10) }, now);
    expect(exactly10.tone).toBe("waiting");
    const stuck = judgeStatusView({ status: "queued", createdAt: new Date(minutesAgo(10).getTime() - 1) }, now);
    expect(stuck).toMatchObject({ tone: "error", headline: "Not counted" });
    expect(stuck.detail).toContain(TIMED_OUT_ERROR);
  });

  it("shows a stored error with its message", () => {
    const view = judgeStatusView({ status: "error", createdAt: minutesAgo(1), error: "Could not start the judge." }, now);
    expect(view).toMatchObject({ tone: "error", headline: "Not counted" });
    expect(view.detail).toContain("Could not start the judge.");
  });

  it("shows passed/total and the verdict when done", () => {
    expect(judgeStatusView(done({ passed: 3, total: 3, verdict: "Accepted" }, 10), now)).toEqual({
      tone: "passed",
      headline: "Accepted",
      detail: "Passed 3 of 3 tests.",
    });
    expect(judgeStatusView(done({ passed: 1, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 }), now)).toEqual({
      tone: "failed",
      headline: "Wrong Answer on test 2",
      detail: "Passed 1 of 3 tests.",
    });
  });

  it("passes the compiler output through for a compilation error", () => {
    const view = judgeStatusView(
      done({ passed: 0, total: 3, verdict: "Compilation Error", compileOutput: "main.cpp:1: error" }, 0),
      now,
    );
    expect(view).toMatchObject({ tone: "failed", headline: "Compilation Error", compileOutput: "main.cpp:1: error" });
  });
});

describe("insertIndent", () => {
  it("inserts spaces at the cursor", () => {
    expect(insertIndent("ab", 1, 1)).toEqual({ value: `a${INDENT}b`, cursor: 1 + INDENT.length });
  });

  it("replaces a selection", () => {
    expect(insertIndent("abcd", 1, 3)).toEqual({ value: `a${INDENT}d`, cursor: 1 + INDENT.length });
  });

  it("uses spaces, never a tab character", () => {
    expect(INDENT).toMatch(/^ +$/);
  });
});

describe("codeSize", () => {
  it("counts UTF-8 bytes against 32 KB", () => {
    expect(codeSize("")).toEqual({ text: "0.0 KB of 32 KB", tooBig: false });
    expect(codeSize("x".repeat(MAX_CODE_BYTES))).toEqual({ text: "32.0 KB of 32 KB", tooBig: false });
    expect(codeSize("x".repeat(MAX_CODE_BYTES + 1)).tooBig).toBe(true);
    expect(codeSize("é".repeat(MAX_CODE_BYTES / 2) + "x").tooBig).toBe(true);
  });
});
