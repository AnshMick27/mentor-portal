import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maxDuration, POST } from "@/app/api/feedback/route";
import { AiFeedbackError, type Feedback } from "@/lib/ai/feedback";
import { generateFeedback } from "@/lib/ai/provider";
import { onFinished } from "@/lib/submissions/onFinished";
import { storedSubmissionSchema } from "@/lib/validation/submission";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});
vi.mock("@/lib/ai/provider", () => ({ generateFeedback: vi.fn() }));
vi.mock("@/lib/submissions/onFinished", () => ({ onFinished: vi.fn(async () => undefined) }));

const aiMock = vi.mocked(generateFeedback);
const onFinishedMock = vi.mocked(onFinished);

type Body = { submission?: { id: string; attempt: number; status: string; result: Feedback }; error?: string };

const FEEDBACK: Feedback = {
  score: 7.5,
  summary: "A clear resume with good projects.",
  strengths: ["Clear projects", "Good skills section"],
  improvements: ["Add numbers to results", "Fix the date format"],
  nextSteps: ["Quantify two project outcomes"],
  criteria: [{ name: "Projects", score: 8, comment: "Strong tech stack." }],
};

const RESUME = "Asha Sharma, B.Tech CSE. Projects: campus canteen app built with React and Firebase.";
const INTRO = "Good morning. ".repeat(30).trim(); // 419 chars

const DAY = 24 * 60 * 60 * 1000;

function user(role: "student" | "mentor" | "viewer") {
  return { name: "Stu", email: "stu@college.ac.in", role, onboarded: true, showOnLeaderboard: false };
}

function task(overrides: Record<string, unknown> = {}) {
  const now = Timestamp.now();
  return {
    title: "Resume review",
    type: "resume",
    description: "Upload your resume.",
    dueAt: Timestamp.fromMillis(Date.now() + DAY),
    status: "published",
    maxAttempts: 2,
    createdBy: "m1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function submission(status: string, overrides: Record<string, unknown> = {}) {
  return {
    taskId: "resume1",
    uid: "s1",
    type: "resume",
    attempt: 1,
    createdAt: Timestamp.now(),
    status,
    content: RESUME,
    ...overrides,
  };
}

async function post(token: string | undefined, body: unknown): Promise<{ status: number; body: Body }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const request = new Request("http://localhost/api/feedback", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Body };
}

const resumeBody = { taskId: "resume1", type: "resume", content: `  ${RESUME}  ` };
const submissions = () => fakeAdmin.collection("submissions");

beforeEach(() => {
  fakeAdmin.reset();
  aiMock.mockReset();
  aiMock.mockResolvedValue(FEEDBACK);
  onFinishedMock.mockClear();
  fakeAdmin.tokens.set("stu", { uid: "s1", email: "stu@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.users.set("s1", user("student"));
  fakeAdmin.users.set("m1", user("mentor"));
  fakeAdmin.users.set("v1", user("viewer"));
  fakeAdmin.collection("tasks").set("resume1", task());
  fakeAdmin.collection("tasks").set("intro1", task({ type: "intro_written", title: "Intro" }));
});

describe("POST /api/feedback — success", () => {
  it("stores a done submission with a valid result and returns it", async () => {
    const { status, body } = await post("stu", resumeBody);
    expect(status).toBe(200);
    expect(body.submission).toMatchObject({ attempt: 1, status: "done", result: { score: 7.5 } });

    const stored = submissions().get(body.submission!.id);
    const parsed = storedSubmissionSchema.parse(stored);
    expect(parsed).toMatchObject({ uid: "s1", taskId: "resume1", type: "resume", attempt: 1, status: "done" });
    expect(parsed.content).toBe(RESUME); // trimmed
    expect(parsed.result).toEqual(FEEDBACK);
    expect(parsed.error).toBeUndefined();
  });

  it("sends the trimmed text with the task type's rubric to the AI", async () => {
    await post("stu", { taskId: "intro1", type: "intro_written", content: INTRO });
    expect(aiMock).toHaveBeenCalledOnce();
    const input = aiMock.mock.calls[0]![0];
    expect(input.type).toBe("intro_written");
    expect(input.content).toBe(INTRO);
    expect(input.rubric.criteria.length).toBeGreaterThan(0);
  });

  it("calls onFinished after the submission is stored", async () => {
    const { body } = await post("stu", resumeBody);
    expect(onFinishedMock).toHaveBeenCalledWith({ submissionId: body.submission!.id, uid: "s1", taskId: "resume1" });
  });

  it("gives a long AI call enough time on Vercel", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(60);
  });
});

describe("POST /api/feedback — who may submit", () => {
  it("401s without a token", async () => {
    expect((await post(undefined, resumeBody)).status).toBe(401);
  });

  it("403s mentors and viewers and writes nothing", async () => {
    expect((await post("mentor", resumeBody)).status).toBe(403);
    expect((await post("viewer", resumeBody)).status).toBe(403);
    expect(submissions().size).toBe(0);
    expect(aiMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/feedback — task checks", () => {
  it("404s a missing task and a draft task alike", async () => {
    fakeAdmin.collection("tasks").set("draft1", task({ status: "draft" }));
    const missing = await post("stu", { ...resumeBody, taskId: "nope" });
    const draft = await post("stu", { ...resumeBody, taskId: "draft1" });
    expect(missing).toEqual({ status: 404, body: { error: "Task not found." } });
    expect(draft).toEqual(missing);
    expect(submissions().size).toBe(0);
  });

  it("400s when the body's type does not match the task", async () => {
    const { status } = await post("stu", { taskId: "resume1", type: "intro_written", content: INTRO });
    expect(status).toBe(400);
    expect(submissions().size).toBe(0);
  });

  it("refuses a coding task (use the judge instead)", async () => {
    fakeAdmin.collection("tasks").set("code1", task({ type: "coding" }));
    expect((await post("stu", { ...resumeBody, taskId: "code1" })).status).toBeGreaterThanOrEqual(400);
    expect(submissions().size).toBe(0);
  });

  it("accepts work after the due date as late: feedback, flagged, same attempt limit (T44)", async () => {
    fakeAdmin.collection("tasks").set("resume1", task({ dueAt: Timestamp.fromMillis(Date.now() - 1000) }));
    const first = await post("stu", resumeBody);
    expect(first.status).toBe(200);
    expect(first.body.submission).toMatchObject({ attempt: 1, late: true, status: "done" });
    expect(submissions().get(first.body.submission!.id)).toMatchObject({ late: true, status: "done" });
    expect(aiMock).toHaveBeenCalledOnce();

    expect((await post("stu", resumeBody)).status).toBe(200);
    const third = await post("stu", resumeBody); // maxAttempts is 2 in this file
    expect(third.status).toBe(409);
    expect(submissions().size).toBe(2);
  });

  it("does not mark on-time work late", async () => {
    const { body } = await post("stu", resumeBody);
    expect(body.submission).toMatchObject({ late: false });
    expect(submissions().get(body.submission!.id)).not.toHaveProperty("late");
  });
});

describe("POST /api/feedback — size limits", () => {
  it("accepts resume text of exactly 12,000 characters and refuses one more", async () => {
    expect((await post("stu", { ...resumeBody, content: "a".repeat(12_000) })).status).toBe(200);
    const over = await post("stu", { ...resumeBody, content: "a".repeat(12_001) });
    expect(over.status).toBe(400);
    expect(over.body.error).toContain("12,000");
  });

  it("refuses intros under 300 or over 2,500 characters", async () => {
    const intro = (content: string) => post("stu", { taskId: "intro1", type: "intro_written", content });
    expect((await intro("a".repeat(299))).status).toBe(400);
    expect((await intro("a".repeat(2_501))).status).toBe(400);
    expect(submissions().size).toBe(0);
  });

  it("refuses blank text, bad JSON and extra fields", async () => {
    expect((await post("stu", { ...resumeBody, content: "   " })).status).toBe(400);
    expect((await post("stu", "not json")).status).toBe(400);
    expect((await post("stu", { ...resumeBody, score: 10 })).status).toBe(400);
    expect(submissions().size).toBe(0);
  });
});

describe("POST /api/feedback — attempts", () => {
  it("409s once maxAttempts is used and does not call the AI", async () => {
    expect((await post("stu", resumeBody)).body.submission?.attempt).toBe(1);
    expect((await post("stu", resumeBody)).body.submission?.attempt).toBe(2);
    const third = await post("stu", resumeBody);
    expect(third.status).toBe(409);
    expect(third.body.error).toContain("2 attempts");
    expect(submissions().size).toBe(2);
    expect(aiMock).toHaveBeenCalledTimes(2);
  });

  it("does not count errors, timed-out runs, other tasks or other students", async () => {
    const old = Timestamp.fromMillis(Date.now() - 11 * 60 * 1000);
    submissions().set("e1", submission("error", { error: "AI failed" }));
    submissions().set("t1", submission("running", { createdAt: old }));
    submissions().set("o1", submission("done", { taskId: "intro1", type: "intro_written" }));
    submissions().set("o2", submission("done", { uid: "s2" }));
    submissions().set("d1", submission("done"));

    const { status, body } = await post("stu", resumeBody);
    expect(status).toBe(200);
    expect(body.submission?.attempt).toBe(2);
    expect((await post("stu", resumeBody)).status).toBe(409);
  });

  it("counts a submission still running (under 10 minutes)", async () => {
    submissions().set("r1", submission("running"));
    submissions().set("d1", submission("done"));
    expect((await post("stu", resumeBody)).status).toBe(409);
  });
});

describe("POST /api/feedback — AI failure", () => {
  it("marks the submission error with a plain message, returns 502, and does not count it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    aiMock.mockRejectedValueOnce(new AiFeedbackError("invalid_output", "reply invalid after 2 tries: secret detail"));

    const failed = await post("stu", resumeBody);
    expect(failed.status).toBe(502);
    expect(failed.body.error).toContain("not counted");
    expect(failed.body.error).not.toContain("secret detail");

    const [stored] = [...submissions().values()];
    expect(stored).toMatchObject({ status: "error", attempt: 1 });
    expect(stored).not.toHaveProperty("result");
    expect(log).toHaveBeenCalled();
    expect(onFinishedMock).toHaveBeenCalledOnce();

    // The failed attempt is not counted: two more successful attempts are still allowed.
    expect((await post("stu", resumeBody)).body.submission?.attempt).toBe(1);
    expect((await post("stu", resumeBody)).body.submission?.attempt).toBe(2);
    expect((await post("stu", resumeBody)).status).toBe(409);
    log.mockRestore();
  });

  it("treats a provider/config error the same way", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    aiMock.mockRejectedValueOnce(new AiFeedbackError("config", "GROQ_API_KEY is not set"));
    const { status, body } = await post("stu", resumeBody);
    expect(status).toBe(502);
    expect(body.error).not.toContain("GROQ");
    expect([...submissions().values()][0]).toMatchObject({ status: "error" });
    log.mockRestore();
  });
});

describe("POST /api/feedback — integrity counts (T46b)", () => {
  const counts = { pastesBlocked: 1, largestInsert: 30, typedChars: 450, awayCount: 2, awayMs: 4_000, maxCharsPerSec: 6 };
  const introBody = { taskId: "intro1", type: "intro_written", content: INTRO };
  const stored = (id: string) => storedSubmissionSchema.parse(submissions().get(id)).integrity;

  it("stores counts, time and flags for an intro", async () => {
    fakeAdmin.collection("drafts").set("s1_intro1", { uid: "s1", taskId: "intro1", openedAt: Timestamp.fromMillis(Date.now() - 5 * 60_000) });
    const { status, body } = await post("stu", { ...introBody, integrity: counts });
    expect(status).toBe(200);
    expect(stored(body.submission!.id)).toMatchObject({ ...counts, flags: [] });
    expect(stored(body.submission!.id)?.elapsedMs).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it("flags an intro sent without counts, and still gives feedback", async () => {
    const { status, body } = await post("stu", introBody);
    expect(status).toBe(200);
    expect(stored(body.submission!.id)).toEqual({ flags: ["outside_form"] });
    expect(aiMock).toHaveBeenCalledOnce();
  });

  it("never sends the counts to the AI", async () => {
    await post("stu", { ...introBody, integrity: counts });
    expect(JSON.stringify(aiMock.mock.calls[0]![0])).not.toContain("pastesBlocked");
  });

  it("leaves a resume untouched, even if counts are sent", async () => {
    const { body: plain } = await post("stu", resumeBody);
    expect(stored(plain.submission!.id)).toBeUndefined();
    submissions().clear();
    const { status, body } = await post("stu", { ...resumeBody, integrity: counts });
    expect(status).toBe(200);
    expect(stored(body.submission!.id)).toBeUndefined();
  });

  it("refuses bad counts with 400", async () => {
    expect((await post("stu", { ...introBody, integrity: { ...counts, awayMs: "long" } })).status).toBe(400);
    expect(aiMock).not.toHaveBeenCalled();
  });
});
