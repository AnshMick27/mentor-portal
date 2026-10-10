import { z } from "zod";
import {
  MAX_CODE_BYTES,
  MAX_INTRO_CHARS,
  MAX_RESUME_CHARS,
  MAX_SCENARIO_CHARS,
  MIN_INTRO_CHARS,
  MIN_SCENARIO_CHARS,
  utf8Bytes,
} from "@/lib/submissions/limits";
import { isValidTaskId, LANGUAGES, TASK_TYPES } from "@/lib/validation/task";
import { timestampLike } from "@/lib/validation/timestamp";

export const SUBMISSION_STATUSES = ["queued", "running", "done", "error"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Task types whose submissions are marked by the AI (SPEC.md §10). */
export const AI_TASK_TYPES = ["resume", "intro_written", "scenario"] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

/** Same 0–10 scale everywhere (SPEC.md §6), one decimal place. */
export const scoreSchema = z
  .number()
  .min(0)
  .max(10)
  .refine((score) => Math.round(score * 10) / 10 === score, "Score must have at most one decimal place.");

export const criterionSchema = z.object({ name: z.string(), score: scoreSchema, comment: z.string() });
export type Criterion = z.infer<typeof criterionSchema>;

export const judgeResultSchema = z
  .object({
    passed: z.number().int().min(0),
    total: z.number().int().min(1),
    verdict: z.string(),
    firstFailedTest: z.number().int().min(1).optional(),
    /** First 20 lines of compiler output, only with a compilation error (judge-repo/README.md). */
    compileOutput: z.string().optional(),
  })
  .refine((judge) => judge.passed <= judge.total, "passed cannot exceed total.");
export type JudgeResult = z.infer<typeof judgeResultSchema>;

/** `submissions/{id}.result`. The AI's stricter reply shape (2–3 strengths, …) is checked in lib/ai. */
export const submissionResultSchema = z.object({
  score: scoreSchema,
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  nextSteps: z.array(z.string()),
  criteria: z.array(criterionSchema).optional(),
  judge: judgeResultSchema.optional(),
});
export type SubmissionResult = z.infer<typeof submissionResultSchema>;

/** AI tasks typed in a paste-blocked box (intro, scenario answer, T50): integrity counts and the draft timer apply. */
export function isTypedAnswer(type: AiTaskType): type is "intro_written" | "scenario" {
  return type !== "resume";
}

/**
 * Answer-integrity counts the code, intro and scenario forms send with a submission (SPEC.md §8.9). Counts only, never
 * keystrokes. They come from the browser, so they are hints: bounded here, never used for the score.
 */
export const integrityCountsSchema = z.strictObject({
  pastesBlocked: z.number().int().min(0).max(100_000),
  largestInsert: z.number().int().min(0).max(1_000_000),
  typedChars: z.number().int().min(0).max(10_000_000),
  awayCount: z.number().int().min(0).max(100_000),
  awayMs: z.number().int().min(0).max(30 * 24 * 60 * 60 * 1000),
  maxCharsPerSec: z.number().min(0).max(100_000),
});
export type IntegrityCounts = z.infer<typeof integrityCountsSchema>;

/** Flags the server decides from the counts (lib/submissions/integrityFlags.ts). Mentors see them; scores never change. */
export const INTEGRITY_FLAGS = ["outside_form", "pastes_blocked", "fast_typing", "more_than_typed", "quick_answer", "long_away"] as const;
export type IntegrityFlag = (typeof INTEGRITY_FLAGS)[number];

/** `submissions/{id}.integrity` (SPEC.md §6). Counts are absent when the answer was sent outside the form. */
export const storedIntegritySchema = z.object(integrityCountsSchema.shape).partial().extend({
  elapsedMs: z.number().int().min(0).optional(),
  flags: z.array(z.enum(INTEGRITY_FLAGS)),
});
export type StoredIntegrity = z.infer<typeof storedIntegritySchema>;

/** `submissions/{submissionId}` as stored (SPEC.md §6). Not strict: unknown extra fields are ignored. */
export const storedSubmissionSchema = z.object({
  taskId: z.string(),
  uid: z.string(),
  type: z.enum(TASK_TYPES),
  attempt: z.number().int().min(1),
  createdAt: timestampLike,
  status: z.enum(SUBMISSION_STATUSES),
  content: z.string(),
  language: z.enum(LANGUAGES).optional(),
  result: submissionResultSchema.optional(),
  error: z.string().optional(),
  /** Sent after the task's due date: feedback only, never scored (SPEC.md §6, §8.2; T44). */
  late: z.boolean().optional(),
  /** Code and intro only (SPEC.md §8.9). */
  integrity: storedIntegritySchema.optional(),
});
export type StoredSubmission = z.infer<typeof storedSubmissionSchema>;

const taskIdSchema = z.string().refine(isValidTaskId, "Unknown task.");

/** Checks the §7.8 length limit for the text of an AI-marked submission. */
function checkTextLimits(body: { type: AiTaskType; content: string }, ctx: z.RefinementCtx): void {
  const length = body.content.length;
  if (length === 0) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Add your text before submitting." });
  } else if (body.type === "resume" && length > MAX_RESUME_CHARS) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Resume text must be at most 12,000 characters." });
  } else if (body.type === "intro_written" && (length < MIN_INTRO_CHARS || length > MAX_INTRO_CHARS)) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Your introduction must be between 300 and 2,500 characters.",
    });
  } else if (body.type === "scenario" && (length < MIN_SCENARIO_CHARS || length > MAX_SCENARIO_CHARS)) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Your answer must be between 200 and 5,000 characters." });
  }
}

/** `POST /api/feedback` body (resume, written intro or scenario answer). Content is trimmed before the limits apply. */
export const feedbackRequestSchema = z
  .strictObject({
    taskId: taskIdSchema,
    type: z.enum(AI_TASK_TYPES),
    content: z.string().trim(),
    /** Sent by the intro and scenario forms; ignored for a resume. */
    integrity: integrityCountsSchema.optional(),
  })
  .superRefine(checkTextLimits);
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

/** `POST /api/judge/submit` body. Code is not trimmed (whitespace can matter), but must not be blank. */
export const codeSubmitRequestSchema = z.strictObject({
  taskId: taskIdSchema,
  language: z.enum(LANGUAGES, "Choose a language."),
  code: z
    .string()
    .refine((code) => code.trim().length > 0, "Write some code before submitting.")
    .refine((code) => utf8Bytes(code) <= MAX_CODE_BYTES, "Code must be at most 32 KB."),
  integrity: integrityCountsSchema.optional(),
});
export type CodeSubmitRequest = z.infer<typeof codeSubmitRequestSchema>;

/** `POST /api/submissions/draft` body: the code or intro form for this task was opened (SPEC.md §8.9). */
export const draftRequestSchema = z.strictObject({ taskId: taskIdSchema });
