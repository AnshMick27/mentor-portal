import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchJudge, judgeClientPayload, JudgeDispatchError, type JudgeDispatchInput } from "@/lib/judge/dispatch";
import { queuedFetch } from "../ai/helpers";

const env = vi.hoisted(() => ({
  GITHUB_JUDGE_REPO: "ansh/mentor-portal-judge" as string | undefined,
  GITHUB_JUDGE_TOKEN: "github_pat_env" as string | undefined,
}));
vi.mock("@/lib/config/env", () => ({ getServerEnv: () => env }));

const input: JudgeDispatchInput = {
  submissionId: "Sub123abcXYZ",
  problemSlug: "sum-two-numbers",
  language: "cpp",
  code: '#include <iostream>\nint main(){ long long a,b; std::cin>>a>>b; std::cout<<a+b; } // ₹ ✓ "quotes"\n',
};
const config = { repo: "org/judge", token: "github_pat_test" };

type SentRequest = { url: string; init: RequestInit; body: { event_type: string; client_payload: Record<string, string> } };

function sent(fetchMock: ReturnType<typeof queuedFetch>): SentRequest {
  const [url, init] = fetchMock.mock.calls[0]!;
  return { url: String(url), init: init!, body: JSON.parse(String(init!.body)) as SentRequest["body"] };
}

async function dispatchError(promise: Promise<unknown>): Promise<JudgeDispatchError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(JudgeDispatchError);
  return error as JudgeDispatchError;
}

beforeEach(() => {
  env.GITHUB_JUDGE_REPO = "ansh/mentor-portal-judge";
  env.GITHUB_JUDGE_TOKEN = "github_pat_env";
});

describe("dispatchJudge", () => {
  it("sends a repository_dispatch of type judge with the documented payload and GitHub headers", async () => {
    const fetchMock = queuedFetch(new Response(null, { status: 204 }));
    await dispatchJudge(input, { ...config, fetch: fetchMock });

    const { url, init, body } = sent(fetchMock);
    expect(url).toBe("https://api.github.com/repos/org/judge/dispatches");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      accept: "application/vnd.github+json",
      authorization: "Bearer github_pat_test",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    });
    expect(body.event_type).toBe("judge");
    expect(Object.keys(body.client_payload).sort()).toEqual(["codeB64", "language", "problemSlug", "submissionId"]);
    expect(body.client_payload).toMatchObject({ submissionId: "Sub123abcXYZ", problemSlug: "sum-two-numbers", language: "cpp" });
  });

  it("base64-encodes the code as UTF-8 so it round-trips exactly (Unicode, quotes, newlines)", async () => {
    const fetchMock = queuedFetch(new Response(null, { status: 204 }));
    await dispatchJudge(input, { ...config, fetch: fetchMock });
    const { codeB64 } = sent(fetchMock).body.client_payload;
    expect(codeB64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(codeB64!, "base64").toString("utf8")).toBe(input.code);
    expect(judgeClientPayload(input).codeB64).toBe(codeB64);
  });

  it("uses GITHUB_JUDGE_REPO and GITHUB_JUDGE_TOKEN from env by default", async () => {
    const fetchMock = queuedFetch(new Response(null, { status: 204 }));
    await dispatchJudge(input, { fetch: fetchMock });
    const { url, init } = sent(fetchMock);
    expect(url).toBe("https://api.github.com/repos/ansh/mentor-portal-judge/dispatches");
    expect(init.headers).toMatchObject({ authorization: "Bearer github_pat_env" });
  });

  it("fails clearly (config) when env is missing, naming the variables but no values", async () => {
    env.GITHUB_JUDGE_REPO = undefined;
    env.GITHUB_JUDGE_TOKEN = undefined;
    const fetchMock = queuedFetch();
    const error = await dispatchError(dispatchJudge(input, { fetch: fetchMock }));
    expect(error.kind).toBe("config");
    expect(error.message).toContain("GITHUB_JUDGE_REPO");
    expect(error.message).toContain("GITHUB_JUDGE_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();

    env.GITHUB_JUDGE_REPO = "org/judge";
    const tokenOnly = await dispatchError(dispatchJudge(input, { fetch: fetchMock }));
    expect(tokenOnly.message).toBe("Judge is not configured: missing GITHUB_JUDGE_TOKEN.");
  });

  it("refuses a submission id the judge would reject, without calling GitHub", async () => {
    const fetchMock = queuedFetch();
    const error = await dispatchError(dispatchJudge({ ...input, submissionId: "a b" }, { ...config, fetch: fetchMock }));
    expect(error.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a github error on a non-2xx reply, without leaking the token", async () => {
    for (const status of [401, 404, 422, 500]) {
      const fetchMock = queuedFetch(new Response('{"message":"Bad credentials"}', { status }));
      const error = await dispatchError(dispatchJudge(input, { ...config, fetch: fetchMock }));
      expect(error.kind).toBe("github");
      expect(error.message).toContain(`HTTP ${status}`);
      expect(error.message).not.toContain(config.token);
    }
  });

  it("throws a github error when GitHub cannot be reached", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("fetch failed"));
    const error = await dispatchError(dispatchJudge(input, { ...config, fetch: fetchMock }));
    expect(error.kind).toBe("github");
    expect(error.cause).toBeInstanceOf(TypeError);
  });
});
