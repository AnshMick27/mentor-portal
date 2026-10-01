import "server-only";
import { createAnthropicModel } from "@/lib/ai/anthropic";
import { AiFeedbackError, aiFeedbackSchema, type Feedback, type FeedbackModel } from "@/lib/ai/feedback";
import { createGeminiModel } from "@/lib/ai/gemini";
import { createGroqModel } from "@/lib/ai/groq";
import { buildPrompt } from "@/lib/ai/prompt";
import type { Rubric } from "@/lib/ai/rubrics";
import { getServerEnv, type ServerEnv } from "@/lib/config/env";
import type { AiTaskType } from "@/lib/validation/submission";

type AiEnv = Pick<
  ServerEnv,
  "AI_PROVIDER" | "AI_MODEL" | "AI_FALLBACK_PROVIDER" | "AI_FALLBACK_MODEL" | "ANTHROPIC_API_KEY" | "GEMINI_API_KEY" | "GROQ_API_KEY"
>;

/** Picks the provider from `AI_PROVIDER`/`AI_MODEL` (SPEC.md §10). Switching provider = changing env vars. */
export function createFeedbackModel(env: AiEnv, fetchFn?: typeof fetch): FeedbackModel {
  if (!env.AI_MODEL) throw new AiFeedbackError("config", "AI_MODEL is not set");
  const options = { model: env.AI_MODEL, ...(fetchFn ? { fetch: fetchFn } : {}) };

  if (env.AI_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new AiFeedbackError("config", "ANTHROPIC_API_KEY is not set");
    return createAnthropicModel({ apiKey: env.ANTHROPIC_API_KEY, ...options });
  }
  if (env.AI_PROVIDER === "groq") {
    if (!env.GROQ_API_KEY) throw new AiFeedbackError("config", "GROQ_API_KEY is not set");
    return createGroqModel({ apiKey: env.GROQ_API_KEY, ...options });
  }
  if (!env.GEMINI_API_KEY) throw new AiFeedbackError("config", "GEMINI_API_KEY is not set");
  return createGeminiModel({ apiKey: env.GEMINI_API_KEY, ...options });
}

/**
 * The main model, plus the backup from `AI_FALLBACK_PROVIDER`/`AI_FALLBACK_MODEL` when one is set. Every call tries
 * the main model first; only a provider failure (rate limit, outage, auth) moves that one call to the backup, so the
 * main model is used again as soon as it answers. The backup is built on first use, so a broken backup setting never
 * stops the main model from working.
 */
export function createModelWithFallback(env: AiEnv, fetchFn?: typeof fetch): FeedbackModel {
  const primary = createFeedbackModel(env, fetchFn);
  const backupProvider = env.AI_FALLBACK_PROVIDER;
  if (!backupProvider) return primary;

  let backup: FeedbackModel | undefined;
  return async (prompt) => {
    try {
      return await primary(prompt);
    } catch (error) {
      if (!(error instanceof AiFeedbackError) || error.kind !== "provider") throw error;
      console.warn(`AI: ${error.message}; trying the fallback ${backupProvider} model.`);
      if (!env.AI_FALLBACK_MODEL) throw new AiFeedbackError("config", "AI_FALLBACK_MODEL is not set", { cause: error });
      backup ??= createFeedbackModel({ ...env, AI_PROVIDER: backupProvider, AI_MODEL: env.AI_FALLBACK_MODEL }, fetchFn);
      return backup(prompt);
    }
  };
}

export type FeedbackInput = { type: AiTaskType; rubric: Rubric; content: string };

const MAX_TRIES = 2;

/**
 * Asks the AI for feedback and validates the reply (SPEC.md §10). An unusable reply is retried once;
 * after that, or on any provider/config failure (of the backup too, if one is set), an `AiFeedbackError` is thrown
 * (attempt not counted).
 */
export async function generateFeedback(
  input: FeedbackInput,
  model: FeedbackModel = createModelWithFallback(getServerEnv()),
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
