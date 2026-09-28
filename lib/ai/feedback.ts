import { z } from "zod";

/**
 * The JSON shape the AI is asked for. Kept plain (no refinements or transforms) so the SDKs can turn it
 * into a JSON schema; the real limits are checked afterwards by `aiFeedbackSchema`.
 */
export const aiWireSchema = z.object({
  score: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  nextSteps: z.array(z.string()),
  criteria: z.array(z.object({ name: z.string(), score: z.number(), comment: z.string() })),
});

export const MAX_SUMMARY_WORDS = 60;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** 0–10, rounded to one decimal (the model may send 7.25; we store 7.3). */
const aiScore = z
  .number()
  .min(0)
  .max(10)
  .transform((score) => Math.round(score * 10) / 10);

const line = z.string().trim().min(1).max(500);

/** SPEC.md §10 output rules. Anything outside them is "invalid output" (retried once, then an error). */
export const aiFeedbackSchema = z.object({
  score: aiScore,
  summary: z
    .string()
    .trim()
    .min(1)
    .refine((summary) => countWords(summary) <= MAX_SUMMARY_WORDS, `Summary must be at most ${MAX_SUMMARY_WORDS} words.`),
  strengths: z.array(line).min(2).max(3),
  improvements: z.array(line).min(2).max(3),
  nextSteps: z.array(line).min(1).max(3),
  criteria: z
    .array(z.object({ name: z.string().trim().min(1), score: aiScore, comment: z.string().trim().min(1).max(500) }))
    .min(1)
    .max(12),
});
export type Feedback = z.output<typeof aiFeedbackSchema>;

export type AiErrorKind = "config" | "provider" | "invalid_output";

/**
 * Every AI failure is one of: missing/invalid configuration, the provider call failing (network, auth,
 * rate limit), or a reply we cannot use. The message is for server logs; users get plain English.
 */
export class AiFeedbackError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiFeedbackError";
  }
}

export type ModelPrompt = { system: string; user: string };

/** One provider call. Resolves with the parsed (not yet validated) JSON reply or throws `AiFeedbackError`. */
export type FeedbackModel = (prompt: ModelPrompt) => Promise<unknown>;
