import { createHmac } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/judge/callback/route";
import { JUDGE_FAILED_MESSAGE, judgeSummary } from "@/lib/submissions/judgeSubmission";
import { onFinished } from "@/lib/submissions/onFinished";
import { storedSubmissionSchema } from "@/lib/validation/submission";
import { fakeAdmin } from "../auth/fakeAdmin";

const env = vi.hoisted(() => ({ JUDGE_WEBHOOK_SECRET: "test-webhook-secret" as string | undefined }));
vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", () => ({ getServerEnv: () => env }));
vi.mock("@/lib/submissions/onFinished", () => ({ onFinished: vi.fn(async () => undefined) }));

const onFinishedMock = vi.mocked(onFinished);
const MINUTE = 60 * 1000;
const SUB_ID = "sub123";

function sign(body: string, secret = "test-webhook-secret"): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function done(judge: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ submissionId: SUB_ID, status: "done", judge, ...extra });
}

const bodies = {
  accepted: done({ passed: 3, total: 3, verdict: "Accepted" }),
  wrong: done({ passed: 1, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 }),
  compile: done({ passed: 0, total: 3, verdict: "Compilation Error" }, { compileOutput: "main.cpp:1: error: x" }),
  error: JSON.stringify({ submissionId: SUB_ID, status: "error", error: "docker pull failed" }),
};

async function callback(body: string, signature: string | null = sign(body)) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== null) headers["x-judge-signature"] = signature;
  const response = await POST(new Request("http://localhost/api/judge/callback", { method: "POST", headers, body }));
  return { status: response.status, body: (await response.json()) as { ok?: boolean; status?: string; error?: string } };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "code1",
    uid: "s1",
    type: "coding",
    attempt: 1,
    createdAt: Timestamp.fromMillis(Date.now() - MINUTE),
    status: "queued",
    content: "print(1)",
    language: "python",
    ...overrides,
  };
}

const submissions = () => fakeAdmin.collection("submissions");
const stored = () => storedSubmissionSchema.parse(submissions().get(SUB_ID));

beforeEach(() => {
  fakeAdmin.reset();
  env.JUDGE_WEBHOOK_SECRET = "test-webhook-secret";
  onFinishedMock.mockClear();
  submissions().set(SUB_ID, submission());
});

describe("POST /api/judge/callback — results", () => {
  it("stores an Accepted result with score 10 and calls onFinished", async () => {
    const { status, body } = await callback(bodies.accepted);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, status: "done" });
    const doc = stored();
    expect(doc.status).toBe("done");
    expect(doc.result).toEqual({
      score: 10,
      summary: "Accepted: all 3 tests passed.",
      strengths: [],
      improvements: [],
      nextSteps: [],
      judge: { passed: 3, total: 3, verdict: "Accepted" },
    });
    expect(onFinishedMock).toHaveBeenCalledWith({ submissionId: SUB_ID, uid: "s1", taskId: "code1" });
  });

  it("stores a partial score with codingScore (1 of 3 → 3.3) and the failing test", async () => {
    await callback(bodies.wrong);
    const doc = stored();
    expect(doc.result?.score).toBe(3.3);
    expect(doc.result?.judge).toEqual({ passed: 1, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 });
    expect(doc.result?.summary).toBe("Wrong Answer on test 2: 1 of 3 tests passed.");
  });

  it("stores a compilation error with score 0 and the compiler output", async () => {
    await callback(bodies.compile);
    const doc = stored();
    expect(doc.status).toBe("done");
    expect(doc.result?.score).toBe(0);
    expect(doc.result?.judge?.compileOutput).toBe("main.cpp:1: error: x");
  });

  it("also accepts a submission the judge already marked running", async () => {
    submissions().set(SUB_ID, submission({ status: "running" }));
    expect((await callback(bodies.accepted)).status).toBe(200);
  });

  it("marks a judge internal error as error (not counted) without leaking the judge's message", async () => {
    const { status, body } = await callback(bodies.error);
    expect(status).toBe(200);
    expect(body.status).toBe("error");
    const doc = stored();
    expect(doc.status).toBe("error");
    expect(doc.error).toBe(JUDGE_FAILED_MESSAGE);
    expect(doc.result).toBeUndefined();
    expect(onFinishedMock).toHaveBeenCalledOnce();
  });
});

describe("POST /api/judge/callback — signature", () => {
  it("401s a missing, wrong-secret or garbled signature and changes nothing", async () => {
    for (const signature of [null, sign(bodies.accepted, "other-secret"), "sha256=abc", "nonsense"]) {
      const { status } = await callback(bodies.accepted, signature);
      expect(status).toBe(401);
    }
    expect(stored().status).toBe("queued");
    expect(onFinishedMock).not.toHaveBeenCalled();
  });

  it("401s a tampered body", async () => {
    const tampered = bodies.wrong.replace('"passed":1', '"passed":3').replace("Wrong Answer", "Accepted");
    expect((await callback(tampered, sign(bodies.wrong))).status).toBe(401);
    expect(stored().status).toBe("queued");
  });

  it("400s a correctly signed body that breaks the callback contract", async () => {
    const bad = done({ passed: 2, total: 3, verdict: "Accepted" });
    expect((await callback(bad)).status).toBe(400);
    expect((await callback("not json")).status).toBe(400);
    expect(stored().status).toBe("queued");
  });

  it("413s an oversized body and 500s when the secret is not configured", async () => {
    const huge = " ".repeat(70 * 1024);
    expect((await callback(huge)).status).toBe(413);
    env.JUDGE_WEBHOOK_SECRET = undefined;
    expect((await callback(bodies.accepted)).status).toBe(500);
    expect(stored().status).toBe("queued");
  });
});

describe("POST /api/judge/callback — only waiting submissions change", () => {
  it("ignores a duplicate callback (409) and keeps the first result", async () => {
    expect((await callback(bodies.wrong)).status).toBe(200);
    const { status } = await callback(bodies.accepted);
    expect(status).toBe(409);
    expect(stored().result?.score).toBe(3.3);
    expect(onFinishedMock).toHaveBeenCalledOnce();
  });

  it("ignores a late callback for a submission stuck more than 10 minutes (shown as not counted)", async () => {
    submissions().set(SUB_ID, submission({ createdAt: Timestamp.fromMillis(Date.now() - 11 * MINUTE) }));
    expect((await callback(bodies.accepted)).status).toBe(409);
    expect(stored().status).toBe("queued");
    expect(onFinishedMock).not.toHaveBeenCalled();
  });

  it("409s an unknown submission, an errored one, and a non-coding one", async () => {
    submissions().delete(SUB_ID);
    expect((await callback(bodies.accepted)).status).toBe(409);

    submissions().set(SUB_ID, submission({ status: "error", error: "x" }));
    expect((await callback(bodies.accepted)).status).toBe(409);
    expect(stored().status).toBe("error");

    submissions().set(SUB_ID, submission({ type: "resume", status: "running", language: undefined }));
    expect((await callback(bodies.accepted)).status).toBe(409);
    expect(stored().status).toBe("running");
    expect(onFinishedMock).not.toHaveBeenCalled();
  });
});

describe("judgeSummary", () => {
  it("describes each verdict in plain English", () => {
    expect(judgeSummary({ passed: 0, total: 4, verdict: "Time Limit Exceeded", firstFailedTest: 1 })).toBe(
      "Time Limit Exceeded on test 1: 0 of 4 tests passed.",
    );
    expect(judgeSummary({ passed: 2, total: 4, verdict: "Runtime Error", firstFailedTest: 3 })).toBe(
      "Runtime Error on test 3: 2 of 4 tests passed.",
    );
    expect(judgeSummary({ passed: 0, total: 4, verdict: "Compilation Error" })).toMatch(/did not compile/);
  });
});
