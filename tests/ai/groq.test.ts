import { describe, expect, it } from "vitest";
import { AiFeedbackError } from "@/lib/ai/feedback";
import { FEEDBACK_JSON_SCHEMA } from "@/lib/ai/groq";
import { createFeedbackModel, generateFeedback } from "@/lib/ai/provider";
import { getRubric } from "@/lib/ai/rubrics";
import { jsonResponse, queuedFetch, validFeedback } from "./helpers";

const input = { type: "intro_written" as const, rubric: getRubric("intro_written"), content: "Hello, I am Riya." };
const groqEnv = { AI_PROVIDER: "groq" as const, AI_MODEL: "openai/gpt-oss-120b", GROQ_API_KEY: "gsk-test" };

function groqReply(content: string | null, finishReason = "stop"): Response {
  return jsonResponse({
    id: "chatcmpl-test",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }],
  });
}

async function failureKind(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiFeedbackError);
  return (error as AiFeedbackError).kind;
}

type SentBody = {
  model: string;
  messages: { role: string; content: string }[];
  response_format: { type: string; json_schema: { name: string; strict: boolean; schema: unknown } };
};

function sentBody(fetchMock: ReturnType<typeof queuedFetch>, call = 0): SentBody {
  return JSON.parse(String(fetchMock.mock.calls[call]![1]?.body)) as SentBody;
}

describe("Groq feedback schema", () => {
  it("meets strict-mode rules: every field required, no extra properties, no $schema key", () => {
    const schema = FEEDBACK_JSON_SCHEMA as {
      required: string[];
      additionalProperties: boolean;
      properties: { criteria: { items: { required: string[]; additionalProperties: boolean } } };
    };
    expect(schema).not.toHaveProperty("$schema");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.sort()).toEqual(
      ["criteria", "improvements", "nextSteps", "score", "strengths", "summary"].sort(),
    );
    expect(schema.properties.criteria.items.additionalProperties).toBe(false);
    expect(schema.properties.criteria.items.required.sort()).toEqual(["comment", "name", "score"]);
  });
});

describe("generateFeedback with Groq (mocked fetch)", () => {
  it("fails clearly when GROQ_API_KEY is missing", () => {
    expect(() => createFeedbackModel({ ...groqEnv, GROQ_API_KEY: undefined })).toThrow("GROQ_API_KEY is not set");
  });

  it("returns validated feedback and sends a strict json_schema chat completion", async () => {
    const fetchMock = queuedFetch(groqReply(JSON.stringify(validFeedback())));
    const feedback = await generateFeedback(input, createFeedbackModel(groqEnv, fetchMock));

    expect(feedback.score).toBe(7.3);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer gsk-test");

    const body = sentBody(fetchMock);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[0]!.content).toContain("untrusted data");
    expect(body.messages[1]!.content).toContain("<submission>\nHello, I am Riya.\n</submission>");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "feedback", strict: true, schema: FEEDBACK_JSON_SCHEMA },
    });
  });

  it("uses best-effort mode for models Groq does not list as strict-capable", async () => {
    const fetchMock = queuedFetch(groqReply(JSON.stringify(validFeedback())));
    await generateFeedback(input, createFeedbackModel({ ...groqEnv, AI_MODEL: "some/other-model" }, fetchMock));
    expect(sentBody(fetchMock).response_format.json_schema.strict).toBe(false);
  });

  it("retries once after a best-effort schema mismatch (HTTP 400), then succeeds", async () => {
    const fetchMock = queuedFetch(
      jsonResponse({ error: { message: "Generated JSON does not match the expected schema." } }, 400),
      groqReply(JSON.stringify(validFeedback())),
    );
    await expect(generateFeedback(input, createFeedbackModel(groqEnv, fetchMock))).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two unusable replies (cut off, then too few strengths)", async () => {
    const fetchMock = queuedFetch(
      groqReply('{"score": 7', "length"),
      groqReply(JSON.stringify(validFeedback({ strengths: ["one"] }))),
    );
    expect(await failureKind(generateFeedback(input, createFeedbackModel(groqEnv, fetchMock)))).toBe(
      "invalid_output",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats empty content and non-JSON content as unusable", async () => {
    const fetchMock = queuedFetch(groqReply(null), groqReply("not json"));
    expect(await failureKind(generateFeedback(input, createFeedbackModel(groqEnv, fetchMock)))).toBe(
      "invalid_output",
    );
  });

  it("reports other HTTP errors and network failures as provider errors, without retrying", async () => {
    const limited = queuedFetch(jsonResponse({ error: { message: "Rate limit reached" } }, 429));
    expect(await failureKind(generateFeedback(input, createFeedbackModel(groqEnv, limited)))).toBe("provider");
    expect(limited).toHaveBeenCalledTimes(1);

    const badRequest = queuedFetch(jsonResponse({ error: { message: "model not found" } }, 400));
    expect(await failureKind(generateFeedback(input, createFeedbackModel(groqEnv, badRequest)))).toBe("provider");

    const offline = queuedFetch();
    offline.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await failureKind(generateFeedback(input, createFeedbackModel(groqEnv, offline)))).toBe("provider");
  });
});
