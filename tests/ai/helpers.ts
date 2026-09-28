import { vi } from "vitest";

/** A reply that passes `aiFeedbackSchema`. */
export function validFeedback(overrides: Record<string, unknown> = {}) {
  return {
    score: 7.25,
    summary: "A clear resume with solid projects. Tighten the bullets and add numbers.",
    strengths: ["Projects list the tech stack.", "Education section is complete."],
    improvements: ["Quantify project impact.", "Fix inconsistent date formats."],
    nextSteps: ["Add one metric to each project bullet."],
    criteria: [{ name: "Projects", score: 8, comment: "Good detail." }],
    ...overrides,
  };
}

/** A `fetch` mock that answers each call with the next response in the list. */
export function queuedFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  return fn;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A Messages API reply whose single text block is `text`. */
export function anthropicReply(text: string, stopReason = "end_turn"): Response {
  return jsonResponse({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

export function geminiReply(text: string, finishReason = "STOP"): Response {
  return jsonResponse({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }] });
}
