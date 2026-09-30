import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/judge/submit/route";
import { dispatchJudge, JudgeDispatchError } from "@/lib/judge/dispatch";
import { DISPATCH_FAILED_MESSAGE } from "@/lib/submissions/judgeSubmission";
import { MAX_CODE_BYTES } from "@/lib/submissions/limits";
import { onFinished } from "@/lib/submissions/onFinished";
import { storedSubmissionSchema } from "@/lib/validation/submission";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});
vi.mock("@/lib/judge/dispatch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/judge/dispatch")>()),
  dispatchJudge: vi.fn(),
}));
vi.mock("@/lib/submissions/onFinished", () => ({ onFinished: vi.fn(async () => undefined) }));

const dispatchMock = vi.mocked(dispatchJudge);
const onFinishedMock = vi.mocked(onFinished);

type Body = { submission?: { id: string; attempt: number; status: string }; error?: string };

const CODE = "a, b = map(int, input().split())\nprint(a + b)\n";
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function user(role: "student" | "mentor" | "viewer") {
  return { name: "Stu", email: "stu@college.ac.in", role, onboarded: true, showOnLeaderboard: false };
}

function task(overrides: Record<string, unknown> = {}) {
  const now = Timestamp.now();
  return {
    title: "Sum two numbers",
    type: "coding",
    description: "Add two numbers.",
    dueAt: Timestamp.fromMillis(Date.now() + DAY),
    status: "published",
    maxAttempts: 2,
    createdBy: "m1",
    createdAt: now,
    updatedAt: now,
    coding: {
      problemSlug: "sum-two-numbers",
      languages: ["python", "cpp"],
      sampleTests: [{ input: "1 2", output: "3" }],
      timeLimitMs: 2000,
    },
    ...overrides,
  };
}

function submission(status: string, overrides: Record<string, unknown> = {}) {
  return {
    taskId: "code1",
    uid: "s1",
    type: "coding",
    attempt: 1,
    createdAt: Timestamp.now(),
    status,
    content: CODE,
    language: "python",
    ...overrides,
  };
}

async function post(token: string | undefined, body: unknown): Promise<{ status: number; body: Body }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const request = new Request("http://localhost/api/judge/submit", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Body };
}

const codeBody = { taskId: "code1", language: "python", code: CODE };
const submissions = () => fakeAdmin.collection("submissions");

beforeEach(() => {
  fakeAdmin.reset();
  dispatchMock.mockReset();
  dispatchMock.mockResolvedValue(undefined);
  onFinishedMock.mockClear();
  fakeAdmin.tokens.set("stu", { uid: "s1", email: "stu@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.users.set("s1", user("student"));
  fakeAdmin.users.set("m1", user("mentor"));
  fakeAdmin.users.set("v1", user("viewer"));
  fakeAdmin.collection("tasks").set("code1", task());
  fakeAdmin.collection("tasks").set("resume1", task({ type: "resume", coding: undefined }));
});

describe("POST /api/judge/submit — success", () => {
  it("creates a queued submission and dispatches it to the judge", async () => {
    const { status, body } = await post("stu", codeBody);
    expect(status).toBe(202);
    expect(body.submission).toMatchObject({ attempt: 1, status: "queued" });

    const id = body.submission!.id;
    const stored = storedSubmissionSchema.parse(submissions().get(id));
    expect(stored).toMatchObject({ uid: "s1", taskId: "code1", type: "coding", attempt: 1, status: "queued" });
    expect(stored.language).toBe("python");
    expect(stored.content).toBe(CODE); // not trimmed
    expect(stored.result).toBeUndefined();

    expect(dispatchMock).toHaveBeenCalledOnce();
    expect(dispatchMock).toHaveBeenCalledWith({
      submissionId: id,
      problemSlug: "sum-two-numbers",
      language: "python",
      code: CODE,
    });
    expect(onFinishedMock).not.toHaveBeenCalled();
  });

  it("numbers the next attempt after earlier ones, skipping errors", async () => {
    submissions().set("old1", submission("done", { result: { score: 5, summary: "", strengths: [], improvements: [], nextSteps: [] } }));
    submissions().set("old2", submission("error", { error: "x" }));
    const { status, body } = await post("stu", codeBody);
    expect(status).toBe(202);
    expect(body.submission!.attempt).toBe(2);
  });
});

describe("POST /api/judge/submit — who may submit", () => {
  it("401s without a token", async () => {
    expect((await post(undefined, codeBody)).status).toBe(401);
  });

  it("403s mentors and viewers and writes nothing", async () => {
    expect((await post("mentor", codeBody)).status).toBe(403);
    expect((await post("viewer", codeBody)).status).toBe(403);
    expect(submissions().size).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/judge/submit — refusals", () => {
  async function expectRefused(body: unknown, status: number, message?: RegExp) {
    const result = await post("stu", body);
    expect(result.status).toBe(status);
    if (message) expect(result.body.error).toMatch(message);
    expect(submissions().size).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  }

  it("refuses a missing or draft task with the same 404", async () => {
    fakeAdmin.collection("tasks").set("draft1", task({ status: "draft" }));
    await expectRefused({ ...codeBody, taskId: "nope" }, 404, /not found/i);
    await expectRefused({ ...codeBody, taskId: "draft1" }, 404, /not found/i);
  });

  it("refuses a task that is not a coding task", async () => {
    await expectRefused({ ...codeBody, taskId: "resume1" }, 400);
  });

  it("refuses after the due date", async () => {
    fakeAdmin.collection("tasks").set("code1", task({ dueAt: Timestamp.fromMillis(Date.now() - MINUTE) }));
    await expectRefused(codeBody, 403, /due date/i);
  });

  it("refuses a language the task does not allow", async () => {
    await expectRefused({ ...codeBody, language: "java" }, 400, /Java is not allowed/);
  });

  it("refuses an unknown language, blank code and extra fields", async () => {
    await expectRefused({ ...codeBody, language: "rust" }, 400);
    await expectRefused({ ...codeBody, code: "  \n " }, 400);
    await expectRefused({ ...codeBody, score: 10 }, 400);
    await expectRefused("not json", 400);
  });

  it("accepts code of exactly 32 KB and refuses one byte more", async () => {
    await expectRefused({ ...codeBody, code: "x".repeat(MAX_CODE_BYTES + 1) }, 400, /32 KB/);
    await expectRefused({ ...codeBody, code: "é".repeat(MAX_CODE_BYTES / 2) + "x" }, 400, /32 KB/);
    expect((await post("stu", { ...codeBody, code: "x".repeat(MAX_CODE_BYTES) })).status).toBe(202);
  });

  it("refuses when every attempt is used; running and fresh queued ones count", async () => {
    submissions().set("a", submission("done", { result: { score: 3, summary: "", strengths: [], improvements: [], nextSteps: [] } }));
    submissions().set("b", submission("queued", { attempt: 2 }));
    const result = await post("stu", codeBody);
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/all 2 attempts/);
    expect(submissions().size).toBe(2);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("does not count a submission stuck in the queue for more than 10 minutes", async () => {
    submissions().set("a", submission("done", { result: { score: 3, summary: "", strengths: [], improvements: [], nextSteps: [] } }));
    submissions().set("b", submission("queued", { createdAt: Timestamp.fromMillis(Date.now() - 11 * MINUTE) }));
    expect((await post("stu", codeBody)).status).toBe(202);
  });
});

describe("POST /api/judge/submit — dispatch failure", () => {
  it.each([
    new JudgeDispatchError("github", "GitHub refused the judge dispatch (HTTP 404)"),
    new JudgeDispatchError("config", "Judge is not configured: missing GITHUB_JUDGE_TOKEN."),
  ])("marks the submission error (not counted) and asks the student to retry: $kind", async (failure) => {
    dispatchMock.mockRejectedValueOnce(failure);
    const { status, body } = await post("stu", codeBody);
    expect(status).toBe(502);
    expect(body.error).toBe(DISPATCH_FAILED_MESSAGE);
    expect(body.error).not.toMatch(/GitHub|TOKEN/);

    const [[id, doc]] = [...submissions()];
    const stored = storedSubmissionSchema.parse(doc);
    expect(stored.status).toBe("error");
    expect(stored.error).toBe(DISPATCH_FAILED_MESSAGE);
    expect(onFinishedMock).toHaveBeenCalledWith({ submissionId: id, uid: "s1", taskId: "code1" });

    // The failed try did not use up an attempt: two more submits still fit into maxAttempts = 2.
    expect((await post("stu", codeBody)).status).toBe(202);
    expect((await post("stu", codeBody)).status).toBe(202);
    expect((await post("stu", codeBody)).status).toBe(409);
  });
});
