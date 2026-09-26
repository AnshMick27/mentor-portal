import { describe, expect, it } from "vitest";
import { codingSchema, taskInputSchema, taskPatchSchema } from "@/lib/validation/task";

const coding = {
  problemSlug: "two-sum",
  languages: ["cpp", "python"],
  sampleTests: [{ input: "2 7\n9", output: "0 1" }],
  timeLimitMs: 2000,
};

const resumeTask = {
  title: "Resume review",
  type: "resume",
  description: "Paste your **resume** text.",
  dueAt: "2026-10-05T23:59:00+05:30",
};

const codingTask = { ...resumeTask, title: "Two sum", type: "coding", coding };

function firstError(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error?.issues[0]?.message;
}

describe("codingSchema", () => {
  it("accepts valid coding settings", () => {
    expect(codingSchema.parse(coding)).toEqual(coding);
  });

  it("requires a lowercase-kebab problem slug", () => {
    for (const problemSlug of ["two-sum", "abc", "a1-b2-c3"]) {
      expect(codingSchema.safeParse({ ...coding, problemSlug }).success, problemSlug).toBe(true);
    }
    for (const problemSlug of ["Two-Sum", "two_sum", "two sum", "-two", "two-", "two--sum", "", "../etc", "a".repeat(61)]) {
      expect(codingSchema.safeParse({ ...coding, problemSlug }).success, problemSlug).toBe(false);
    }
  });

  it("requires at least one known language, without repeats", () => {
    expect(firstError(codingSchema, { ...coding, languages: [] })).toBe("Choose at least one language.");
    expect(codingSchema.safeParse({ ...coding, languages: ["rust"] }).success).toBe(false);
    expect(firstError(codingSchema, { ...coding, languages: ["cpp", "cpp"] })).toBe("Each language may appear only once.");
    expect(codingSchema.safeParse({ ...coding, languages: ["cpp", "java", "python"] }).success).toBe(true);
  });

  it("requires 1 to 5 sample tests", () => {
    const test = { input: "1", output: "1" };
    expect(firstError(codingSchema, { ...coding, sampleTests: [] })).toBe("Add at least one sample test.");
    expect(codingSchema.safeParse({ ...coding, sampleTests: Array(5).fill(test) }).success).toBe(true);
    expect(firstError(codingSchema, { ...coding, sampleTests: Array(6).fill(test) })).toBe("Add at most five sample tests.");
  });

  it("requires a whole-number time limit from 500 to 5000 ms", () => {
    for (const timeLimitMs of [500, 5000]) expect(codingSchema.safeParse({ ...coding, timeLimitMs }).success).toBe(true);
    for (const timeLimitMs of [499, 5001, 1500.5, "2000"]) {
      expect(codingSchema.safeParse({ ...coding, timeLimitMs }).success, String(timeLimitMs)).toBe(false);
    }
  });

  it("rejects hidden tests or any other extra field", () => {
    expect(codingSchema.safeParse({ ...coding, hiddenTests: [{ input: "x", output: "y" }] }).success).toBe(false);
  });
});

describe("taskInputSchema", () => {
  it("defaults to draft and to the per-type max attempts", () => {
    expect(taskInputSchema.parse(resumeTask)).toMatchObject({ status: "draft", maxAttempts: 3 });
    expect(taskInputSchema.parse(codingTask)).toMatchObject({ status: "draft", maxAttempts: 5 });
    expect(taskInputSchema.parse({ ...resumeTask, type: "intro_written" })).toMatchObject({ maxAttempts: 3 });
  });

  it("keeps an explicit status and maxAttempts within 1–10", () => {
    expect(taskInputSchema.parse({ ...resumeTask, status: "published", maxAttempts: 7 })).toMatchObject({
      status: "published",
      maxAttempts: 7,
    });
    for (const maxAttempts of [0, 11, 2.5]) {
      expect(taskInputSchema.safeParse({ ...resumeTask, maxAttempts }).success).toBe(false);
    }
  });

  it("trims the title and requires 3–120 characters", () => {
    expect(taskInputSchema.parse({ ...resumeTask, title: "  Resume  " }).title).toBe("Resume");
    expect(taskInputSchema.safeParse({ ...resumeTask, title: "ab" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...resumeTask, title: "a".repeat(121) }).success).toBe(false);
  });

  it("requires a description and a due date with a time zone", () => {
    expect(taskInputSchema.safeParse({ ...resumeTask, description: "   " }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...resumeTask, dueAt: "2026-10-05" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...resumeTask, dueAt: "tomorrow" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...resumeTask, dueAt: "2026-10-05T18:29:00Z" }).success).toBe(true);
  });

  it("requires coding settings for coding tasks only", () => {
    expect(firstError(taskInputSchema, { ...codingTask, coding: undefined })).toBe("Coding tasks need coding settings.");
    expect(firstError(taskInputSchema, { ...resumeTask, coding })).toBe("Only coding tasks have coding settings.");
    expect(taskInputSchema.safeParse(codingTask).success).toBe(true);
  });

  it("rejects unknown fields such as createdBy or hiddenTests", () => {
    expect(taskInputSchema.safeParse({ ...resumeTask, createdBy: "someone" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...codingTask, hiddenTests: [] }).success).toBe(false);
  });
});

describe("taskPatchSchema", () => {
  it("accepts any subset of fields, e.g. just the status", () => {
    expect(taskPatchSchema.parse({ status: "published" })).toEqual({ status: "published" });
  });

  it("accepts coding: null to remove coding settings", () => {
    expect(taskPatchSchema.parse({ type: "resume", coding: null })).toEqual({ type: "resume", coding: null });
  });

  it("rejects an empty patch and unknown fields", () => {
    expect(firstError(taskPatchSchema, {})).toBe("Nothing to update.");
    expect(taskPatchSchema.safeParse({ createdBy: "x" }).success).toBe(false);
    expect(taskPatchSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});
