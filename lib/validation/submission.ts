import { z } from "zod";
import {
  MAX_CODE_BYTES,
  MAX_INTRO_CHARS,
  MAX_RESUME_CHARS,
  MIN_INTRO_CHARS,
  utf8Bytes,
} from "@/lib/submissions/limits";
import { isValidTaskId, LANGUAGES, TASK_TYPES } from "@/lib/validation/task";
import { timestampLike } from "@/lib/validation/timestamp";

export const SUBMISSION_STATUSES = ["queued", "running", "done", "error"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Task types whose submissions are marked by the AI (SPEC.md §10). */
export const AI_TASK_TYPES = ["resume", "intro_written"] as const;
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
  }
}

/** `POST /api/feedback` body (resume or written intro). Content is trimmed before the limits apply. */
export const feedbackRequestSchema = z
  .strictObject({
    taskId: taskIdSchema,
    type: z.enum(AI_TASK_TYPES),
    content: z.string().trim(),
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
});
export type CodeSubmitRequest = z.infer<typeof codeSubmitRequestSchema>;
