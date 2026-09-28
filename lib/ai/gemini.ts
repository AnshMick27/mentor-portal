import "server-only";
import { z } from "zod";
import { AiFeedbackError, type FeedbackModel } from "@/lib/ai/feedback";

type GeminiOptions = { apiKey: string; model: string; fetch?: typeof fetch };

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const replySchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
});

/** Gemini via its REST `generateContent` endpoint with JSON output mode. */
export function createGeminiModel({ apiKey, model, fetch: fetchFn = fetch }: GeminiOptions): FeedbackModel {
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;

  return async ({ system, user }) => {
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new AiFeedbackError("provider", "Gemini request failed (network)", { cause: error });
    }
    if (!response.ok) {
      throw new AiFeedbackError("provider", `Gemini request failed (${response.status})`);
    }

    const reply = replySchema.safeParse(await response.json().catch(() => undefined));
    const candidate = reply.success ? reply.data.candidates?.[0] : undefined;
    const text = candidate?.content?.parts.map((part) => part.text ?? "").join("") ?? "";
    if (candidate?.finishReason !== "STOP" || text === "") {
      throw new AiFeedbackError("invalid_output", `Gemini reply unusable (finishReason: ${candidate?.finishReason})`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new AiFeedbackError("invalid_output", "Gemini reply was not JSON", { cause: error });
    }
  };
}
