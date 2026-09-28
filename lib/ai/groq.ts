import "server-only";
import { z } from "zod";
import { AiFeedbackError, aiWireSchema, type FeedbackModel } from "@/lib/ai/feedback";

type GroqOptions = { apiKey: string; model: string; fetch?: typeof fetch };

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Models Groq documents as supporting `strict: true` (constrained decoding, output always matches the
 * schema). Every other model gets best-effort mode, where a mismatch comes back as an HTTP 400.
 */
export const GROQ_STRICT_MODELS: ReadonlySet<string> = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
]);

/** `aiWireSchema` as JSON Schema: every field required, `additionalProperties: false` (strict-mode rules). */
export const FEEDBACK_JSON_SCHEMA = Object.fromEntries(
  Object.entries(z.toJSONSchema(aiWireSchema)).filter(([key]) => key !== "$schema"),
);

const replySchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable() }))
    .min(1),
});

/** Groq's OpenAI-compatible chat completions endpoint with a JSON-schema response format. */
export function createGroqModel({ apiKey, model, fetch: fetchFn = fetch }: GroqOptions): FeedbackModel {
  const strict = GROQ_STRICT_MODELS.has(model);

  return async ({ system, user }) => {
    let response: Response;
    try {
      response = await fetchFn(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "feedback", strict, schema: FEEDBACK_JSON_SCHEMA },
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new AiFeedbackError("provider", "Groq request failed (network)", { cause: error });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Best-effort mode reports "Generated JSON does not match the expected schema" as a 400: retryable.
      if (response.status === 400 && /does not match the expected schema/i.test(body)) {
        throw new AiFeedbackError("invalid_output", "Groq reply did not match the schema");
      }
      throw new AiFeedbackError("provider", `Groq request failed (${response.status})`);
    }

    const reply = replySchema.safeParse(await response.json().catch(() => undefined));
    const choice = reply.success ? reply.data.choices[0] : undefined;
    if (choice?.finish_reason !== "stop" || !choice.message.content) {
      throw new AiFeedbackError("invalid_output", `Groq reply unusable (finish_reason: ${choice?.finish_reason})`);
    }
    try {
      return JSON.parse(choice.message.content) as unknown;
    } catch (error) {
      throw new AiFeedbackError("invalid_output", "Groq reply was not JSON", { cause: error });
    }
  };
}
