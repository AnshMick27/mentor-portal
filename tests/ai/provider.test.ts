import { afterEach, describe, expect, it, vi } from "vitest";
import { AiFeedbackError, aiFeedbackSchema } from "@/lib/ai/feedback";
import { createFeedbackModel, createModelWithFallback, generateFeedback } from "@/lib/ai/provider";
import { getRubric } from "@/lib/ai/rubrics";
import { anthropicReply, geminiReply, jsonResponse, queuedFetch, validFeedback } from "./helpers";

const input = { type: "resume" as const, rubric: getRubric("resume"), content: "My resume text" };
const anthropicEnv = { AI_PROVIDER: "anthropic" as const, AI_MODEL: "claude-opus-5", ANTHROPIC_API_KEY: "sk-test" };
const geminiEnv = { AI_PROVIDER: "gemini" as const, AI_MODEL: "gemini-model", GEMINI_API_KEY: "g-test" };

async function failure(promise: Promise<unknown>): Promise<AiFeedbackError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiFeedbackError);
  return error as AiFeedbackError;
}

describe("aiFeedbackSchema", () => {
  it("rounds scores to one decimal", () => {
    expect(aiFeedbackSchema.parse(validFeedback()).score).toBe(7.3);
  });

  it("enforces the SPEC.md §10 counts and limits", () => {
    const bad = [
      { score: 10.5 },
      { score: -1 },
      { strengths: ["only one"] },
      { strengths: ["a", "b", "c", "d"] },
      { improvements: ["one"] },
      { nextSteps: [] },
      { nextSteps: ["a", "b", "c", "d"] },
      { summary: Array.from({ length: 61 }, () => "word").join(" ") },
      { summary: "  " },
      { criteria: [] },
    ];
    for (const overrides of bad) expect(aiFeedbackSchema.safeParse(validFeedback(overrides)).success).toBe(false);
    const sixty = Array.from({ length: 60 }, () => "word").join(" ");
    expect(aiFeedbackSchema.safeParse(validFeedback({ summary: sixty })).success).toBe(true);
  });
});

describe("createFeedbackModel", () => {
  it("fails clearly when the model or the provider's key is missing", async () => {
    expect(() => createFeedbackModel({ ...anthropicEnv, AI_MODEL: undefined })).toThrow("AI_MODEL is not set");
    expect(() => createFeedbackModel({ ...anthropicEnv, ANTHROPIC_API_KEY: undefined })).toThrow(
      "ANTHROPIC_API_KEY is not set",
    );
    expect(() => createFeedbackModel({ ...geminiEnv, GEMINI_API_KEY: undefined })).toThrow("GEMINI_API_KEY is not set");
  });
});

describe("generateFeedback with Anthropic (mocked fetch)", () => {
  it("returns validated feedback and sends the prompt to the Messages API", async () => {
    const fetchMock = queuedFetch(anthropicReply(JSON.stringify(validFeedback())));
    const feedback = await generateFeedback(input, createFeedbackModel(anthropicEnv, fetchMock));

    expect(feedback.score).toBe(7.3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.model).toBe("claude-opus-5");
    expect(body.output_config).toMatchObject({ format: { type: "json_schema" } });
    expect(JSON.stringify(body.messages)).toContain("<submission>\\nMy resume text\\n</submission>");
  });

  it("retries once after an invalid reply, then succeeds", async () => {
    const fetchMock = queuedFetch(
      anthropicReply(JSON.stringify(validFeedback({ strengths: ["just one"] }))),
      anthropicReply(JSON.stringify(validFeedback())),
    );
    await expect(generateFeedback(input, createFeedbackModel(anthropicEnv, fetchMock))).resolves.toMatchObject({
      score: 7.3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two invalid replies (not JSON, then truncated)", async () => {
    const fetchMock = queuedFetch(anthropicReply("not json"), anthropicReply("{}", "max_tokens"));
    const error = await failure(generateFeedback(input, createFeedbackModel(anthropicEnv, fetchMock)));
    expect(error.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a refusal as an unusable reply", async () => {
    const fetchMock = queuedFetch(anthropicReply("", "refusal"), anthropicReply("", "refusal"));
    expect((await failure(generateFeedback(input, createFeedbackModel(anthropicEnv, fetchMock)))).kind).toBe(
      "invalid_output",
    );
  });

  it("reports provider HTTP errors without retrying them as invalid output", async () => {
    const fetchMock = queuedFetch(
      jsonResponse({ type: "error", error: { type: "authentication_error", message: "bad key" } }, 401),
    );
    const error = await failure(generateFeedback(input, createFeedbackModel(anthropicEnv, fetchMock)));
    expect(error.kind).toBe("provider");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("generateFeedback with Gemini (mocked fetch)", () => {
  it("returns validated feedback and calls generateContent with JSON output", async () => {
    const fetchMock = queuedFetch(geminiReply(JSON.stringify(validFeedback())));
    const feedback = await generateFeedback(input, createFeedbackModel(geminiEnv, fetchMock));

    expect(feedback.strengths).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-model:generateContent",
    );
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("g-test");
    const body = JSON.parse(String(init?.body)) as { generationConfig: unknown; systemInstruction: unknown };
    expect(body.generationConfig).toEqual({ responseMimeType: "application/json" });
    expect(JSON.stringify(body.systemInstruction)).toContain("untrusted data");
  });

  it("retries once after an invalid reply, then succeeds", async () => {
    const fetchMock = queuedFetch(geminiReply("{oops"), geminiReply(JSON.stringify(validFeedback())));
    await expect(generateFeedback(input, createFeedbackModel(geminiEnv, fetchMock))).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two invalid replies (blocked, then out-of-range score)", async () => {
    const fetchMock = queuedFetch(
      geminiReply("", "SAFETY"),
      geminiReply(JSON.stringify(validFeedback({ score: 11 }))),
    );
    expect((await failure(generateFeedback(input, createFeedbackModel(geminiEnv, fetchMock)))).kind).toBe(
      "invalid_output",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports HTTP errors and network failures as provider errors", async () => {
    const httpError = queuedFetch(jsonResponse({ error: { message: "quota" } }, 429));
    expect((await failure(generateFeedback(input, createFeedbackModel(geminiEnv, httpError)))).kind).toBe("provider");

    const offline = queuedFetch();
    offline.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await failure(generateFeedback(input, createFeedbackModel(geminiEnv, offline)))).kind).toBe("provider");
  });
});

describe("createModelWithFallback (Groq main model, smaller Groq model as backup)", () => {
  const fallbackEnv = {
    AI_PROVIDER: "groq" as const,
    AI_MODEL: "openai/gpt-oss-120b",
    AI_FALLBACK_PROVIDER: "groq" as const,
    AI_FALLBACK_MODEL: "openai/gpt-oss-20b",
    GROQ_API_KEY: "gsk-test",
  };
  const groqReply = (content: string) =>
    jsonResponse({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });
  const rateLimited = () => jsonResponse({ error: { message: "Rate limit reached", code: "rate_limit_exceeded" } }, 429);
  const sentModel = (fetchMock: ReturnType<typeof queuedFetch>, call: number) =>
    (JSON.parse(String(fetchMock.mock.calls[call]![1]?.body)) as { model: string }).model;

  afterEach(() => vi.restoreAllMocks());

  it("uses the backup model when the main one is rate limited, and the main one again on the next call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = queuedFetch(
      rateLimited(),
      groqReply(JSON.stringify(validFeedback())),
      groqReply(JSON.stringify(validFeedback())),
    );
    const model = createModelWithFallback(fallbackEnv, fetchMock);

    await expect(generateFeedback(input, model)).resolves.toMatchObject({ score: 7.3 });
    expect([sentModel(fetchMock, 0), sentModel(fetchMock, 1)]).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Groq request failed (429)"));

    await generateFeedback(input, model);
    expect(sentModel(fetchMock, 2)).toBe("openai/gpt-oss-120b");
  });

  it("never calls the backup when the main model answers", async () => {
    const fetchMock = queuedFetch(groqReply(JSON.stringify(validFeedback())));
    await generateFeedback(input, createModelWithFallback(fallbackEnv, fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not use the backup for an unusable reply (that is retried on the main model)", async () => {
    const fetchMock = queuedFetch(groqReply("not json"), groqReply(JSON.stringify(validFeedback())));
    await generateFeedback(input, createModelWithFallback(fallbackEnv, fetchMock));
    expect([sentModel(fetchMock, 0), sentModel(fetchMock, 1)]).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-120b"]);
  });

  it("fails as a provider error when the backup is rate limited too", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = queuedFetch(rateLimited(), rateLimited());
    const error = await failure(generateFeedback(input, createModelWithFallback(fallbackEnv, fetchMock)));
    expect(error.kind).toBe("provider");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("behaves exactly as before when no backup is set", async () => {
    const fetchMock = queuedFetch(rateLimited());
    const env = { ...fallbackEnv, AI_FALLBACK_PROVIDER: undefined, AI_FALLBACK_MODEL: undefined };
    expect((await failure(generateFeedback(input, createModelWithFallback(env, fetchMock)))).kind).toBe("provider");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a missing AI_FALLBACK_MODEL only when the backup is needed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { ...fallbackEnv, AI_FALLBACK_MODEL: undefined };
    const ok = queuedFetch(groqReply(JSON.stringify(validFeedback())));
    await expect(generateFeedback(input, createModelWithFallback(env, ok))).resolves.toBeDefined();

    const error = await failure(generateFeedback(input, createModelWithFallback(env, queuedFetch(rateLimited()))));
    expect(error.kind).toBe("config");
    expect(error.message).toBe("AI_FALLBACK_MODEL is not set");
  });
});
