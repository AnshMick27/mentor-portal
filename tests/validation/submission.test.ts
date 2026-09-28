import { describe, expect, it } from "vitest";
import { MAX_CODE_BYTES, MAX_INTRO_CHARS, MAX_RESUME_CHARS, MIN_INTRO_CHARS, utf8Bytes } from "@/lib/submissions/limits";
import {
  codeSubmitRequestSchema,
  feedbackRequestSchema,
  judgeResultSchema,
  scoreSchema,
  storedSubmissionSchema,
  submissionResultSchema,
} from "@/lib/validation/submission";

const ts = { toDate: () => new Date("2026-10-01T10:00:00Z") };

describe("feedbackRequestSchema", () => {
  const resume = (content: string) => ({ taskId: "task_1", type: "resume", content });
  const intro = (content: string) => ({ taskId: "task_1", type: "intro_written", content });

  it("accepts resume text up to exactly 12,000 characters and refuses one more", () => {
    expect(feedbackRequestSchema.safeParse(resume("a".repeat(MAX_RESUME_CHARS))).success).toBe(true);
    const over = feedbackRequestSchema.safeParse(resume("a".repeat(MAX_RESUME_CHARS + 1)));
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe("Resume text must be at most 12,000 characters.");
  });

  it("accepts intros of exactly 300 and 2,500 characters and refuses 299 and 2,501", () => {
    expect(feedbackRequestSchema.safeParse(intro("a".repeat(MIN_INTRO_CHARS))).success).toBe(true);
    expect(feedbackRequestSchema.safeParse(intro("a".repeat(MAX_INTRO_CHARS))).success).toBe(true);
    expect(feedbackRequestSchema.safeParse(intro("a".repeat(MIN_INTRO_CHARS - 1))).success).toBe(false);
    expect(feedbackRequestSchema.safeParse(intro("a".repeat(MAX_INTRO_CHARS + 1))).success).toBe(false);
  });

  it("applies the limits after trimming", () => {
    const padded = feedbackRequestSchema.safeParse(intro(`   ${"a".repeat(MIN_INTRO_CHARS - 1)}   `));
    expect(padded.success).toBe(false);
    const trimmed = feedbackRequestSchema.parse(resume("  my resume  "));
    expect(trimmed.content).toBe("my resume");
  });

  it("refuses blank text, coding type, bad task ids and extra fields", () => {
    expect(feedbackRequestSchema.safeParse(resume("   ")).success).toBe(false);
    expect(feedbackRequestSchema.safeParse({ taskId: "t", type: "coding", content: "x" }).success).toBe(false);
    expect(feedbackRequestSchema.safeParse({ ...resume("x"), taskId: "../users/x" }).success).toBe(false);
    expect(feedbackRequestSchema.safeParse({ ...resume("x"), score: 10 }).success).toBe(false);
  });
});

describe("codeSubmitRequestSchema", () => {
  const body = (code: string, language = "python") => ({ taskId: "task_1", language, code });

  it("accepts code of exactly 32 KB and refuses one byte more", () => {
    expect(codeSubmitRequestSchema.safeParse(body("a".repeat(MAX_CODE_BYTES))).success).toBe(true);
    const over = codeSubmitRequestSchema.safeParse(body("a".repeat(MAX_CODE_BYTES + 1)));
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe("Code must be at most 32 KB.");
  });

  it("counts UTF-8 bytes, not characters", () => {
    const rupee = "₹"; // 3 bytes in UTF-8
    expect(utf8Bytes(rupee)).toBe(3);
    const chars = Math.floor(MAX_CODE_BYTES / 3) + 1;
    expect(chars).toBeLessThan(MAX_CODE_BYTES);
    expect(codeSubmitRequestSchema.safeParse(body(rupee.repeat(chars))).success).toBe(false);
  });

  it("keeps whitespace, refuses blank code, unknown languages and extra fields", () => {
    expect(codeSubmitRequestSchema.parse(body("  print(1)\n")).code).toBe("  print(1)\n");
    expect(codeSubmitRequestSchema.safeParse(body(" \n\t")).success).toBe(false);
    expect(codeSubmitRequestSchema.safeParse(body("x", "rust")).success).toBe(false);
    expect(codeSubmitRequestSchema.safeParse({ ...body("x"), uid: "someone" }).success).toBe(false);
  });
});

describe("result schemas", () => {
  it("scores are 0–10 with at most one decimal", () => {
    for (const ok of [0, 5.5, 10, 7.3]) expect(scoreSchema.safeParse(ok).success).toBe(true);
    for (const bad of [-0.1, 10.1, 7.25, Number.NaN]) expect(scoreSchema.safeParse(bad).success).toBe(false);
  });

  it("judge results need total ≥ 1 and passed ≤ total", () => {
    expect(judgeResultSchema.safeParse({ passed: 3, total: 3, verdict: "Accepted" }).success).toBe(true);
    expect(judgeResultSchema.safeParse({ passed: 4, total: 3, verdict: "x" }).success).toBe(false);
    expect(judgeResultSchema.safeParse({ passed: 0, total: 0, verdict: "x" }).success).toBe(false);
    expect(
      judgeResultSchema.safeParse({ passed: 1, total: 3, verdict: "Wrong Answer on test 2", firstFailedTest: 0 })
        .success,
    ).toBe(false);
  });

  it("parses a stored AI submission and a stored coding submission", () => {
    const result = submissionResultSchema.parse({
      score: 7.5,
      summary: "Good start.",
      strengths: ["a", "b"],
      improvements: ["c", "d"],
      nextSteps: ["e"],
      criteria: [{ name: "Grammar", score: 8, comment: "Clean." }],
    });
    const ai = storedSubmissionSchema.safeParse({
      taskId: "t1", uid: "u1", type: "resume", attempt: 1, createdAt: ts, status: "done", content: "text", result,
    });
    expect(ai.success).toBe(true);

    const coding = storedSubmissionSchema.safeParse({
      taskId: "t2", uid: "u1", type: "coding", attempt: 2, createdAt: ts, status: "queued", content: "code",
      language: "cpp",
    });
    expect(coding.success).toBe(true);
  });

  it("refuses stored submissions with attempt 0, unknown status or a bad createdAt", () => {
    const base = { taskId: "t1", uid: "u1", type: "resume", attempt: 1, createdAt: ts, status: "done", content: "x" };
    expect(storedSubmissionSchema.safeParse({ ...base, attempt: 0 }).success).toBe(false);
    expect(storedSubmissionSchema.safeParse({ ...base, status: "passed" }).success).toBe(false);
    expect(storedSubmissionSchema.safeParse({ ...base, createdAt: "2026-10-01" }).success).toBe(false);
  });
});
