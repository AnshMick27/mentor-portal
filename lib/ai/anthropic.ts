import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiFeedbackError, aiWireSchema, type FeedbackModel } from "@/lib/ai/feedback";

type AnthropicOptions = { apiKey: string; model: string; fetch?: typeof fetch };

/** Claude via the official SDK, with structured JSON output (`messages.parse` + zod). */
export function createAnthropicModel({ apiKey, model, fetch: fetchFn }: AnthropicOptions): FeedbackModel {
  // One SDK retry for 429/5xx/network; the provider-level retry in provider.ts is only for unusable replies.
  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1, ...(fetchFn ? { fetch: fetchFn } : {}) });

  return async ({ system, user }) => {
    let response;
    try {
      response = await client.messages.parse({
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(aiWireSchema) },
      });
    } catch (error) {
      // APIError covers HTTP and connection failures; any other SDK error here is a reply that did not parse.
      if (error instanceof Anthropic.APIError) {
        throw new AiFeedbackError("provider", `Anthropic request failed (${error.status ?? "network"})`, { cause: error });
      }
      throw new AiFeedbackError("invalid_output", "Anthropic reply did not match the schema", { cause: error });
    }

    if (response.stop_reason !== "end_turn" || response.parsed_output === null) {
      throw new AiFeedbackError("invalid_output", `Anthropic reply unusable (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  };
}
