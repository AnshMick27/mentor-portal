import "server-only";
import { createAnthropicModel } from "@/lib/ai/anthropic";
import { AiFeedbackError, aiFeedbackSchema, type Feedback, type FeedbackModel } from "@/lib/ai/feedback";
import { createGeminiModel } from "@/lib/ai/gemini";
import { buildPrompt } from "@/lib/ai/prompt";
import type { Rubric } from "@/lib/ai/rubrics";
import { getServerEnv, type ServerEnv } from "@/lib/config/env";
import type { AiTaskType } from "@/lib/validation/submission";

type AiEnv = Pick<ServerEnv, "AI_PROVIDER" | "AI_MODEL" | "ANTHROPIC_API_KEY" | "GEMINI_API_KEY">;

/** Picks the provider from `AI_PROVIDER`/`AI_MODEL` (SPEC.md §10). Switching provider = changing env vars. */
export function createFeedbackModel(env: AiEnv, fetchFn?: typeof fetch): FeedbackModel {
  if (!env.AI_MODEL) throw new AiFeedbackError("config", "AI_MODEL is not set");
  const options = { model: env.AI_MODEL, ...(fetchFn ? { fetch: fetchFn } : {}) };

  if (env.AI_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new AiFeedbackError("config", "ANTHROPIC_API_KEY is not set");
    return createAnthropicModel({ apiKey: env.ANTHROPIC_API_KEY, ...options });
  }
  if (!env.GEMINI_API_KEY) throw new AiFeedbackError("config", "GEMINI_API_KEY is not set");
  return createGeminiModel({ apiKey: env.GEMINI_API_KEY, ...options });
}

export type FeedbackInput = { type: AiTaskType; rubric: Rubric; content: string };

const MAX_TRIES = 2;

/**
 * Asks the AI for feedback and validates the reply (SPEC.md §10). An unusable reply is retried once;
 * after that, or on any provider/config failure, an `AiFeedbackError` is thrown (attempt not counted).
 */
export async function generateFeedback(
  input: FeedbackInput,
  model: FeedbackModel = createFeedbackModel(getServerEnv()),
): Promise<Feedback> {
  const prompt = buildPrompt(input.type, input.rubric, input.content);
  let lastProblem = "no reply";

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let reply: unknown;
    try {
      reply = await model(prompt);
    } catch (error) {
      if (error instanceof AiFeedbackError && error.kind === "invalid_output") {
        lastProblem = error.message;
        continue;
      }
      throw error;
    }

    const parsed = aiFeedbackSchema.safeParse(reply);
    if (parsed.success) return parsed.data;
    lastProblem = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  }

  throw new AiFeedbackError("invalid_output", `AI reply invalid after ${MAX_TRIES} tries: ${lastProblem}`);
}
