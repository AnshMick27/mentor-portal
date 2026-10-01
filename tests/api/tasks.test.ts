import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getOne, PATCH } from "@/app/api/tasks/[id]/route";
import { GET as list, POST } from "@/app/api/tasks/route";
import { recomputeAllAfter } from "@/lib/stats/recompute";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});
vi.mock("@/lib/stats/recompute", () => ({ recomputeAllAfter: vi.fn(async () => undefined) }));

const recomputeMock = vi.mocked(recomputeAllAfter);

type TaskBody = Record<string, unknown> & { id: string };
type Body = { task?: TaskBody; tasks?: TaskBody[]; error?: string };

const coding = {
  problemSlug: "two-sum",
  languages: ["cpp", "python"],
  sampleTests: [{ input: "2 7\n9", output: "0 1" }],
  timeLimitMs: 2000,
};
const resumeTask = {
  title: "Resume review",
  type: "resume",
  description: "Paste your resume text.",
  dueAt: "2026-10-05T23:59:00+05:30",
};
const codingTask = { ...resumeTask, title: "Two sum", type: "coding", coding };

function request(method: string, token: string | undefined, body?: unknown): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/tasks", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function read(response: Response): Promise<{ status: number; body: Body }> {
  return { status: response.status, body: (await response.json()) as Body };
}

const callList = async (token?: string) => read(await list(request("GET", token)));
const callCreate = async (token: string | undefined, body: unknown) => read(await POST(request("POST", token, body)));
const callGet = async (token: string | undefined, id: string) => read(await getOne(request("GET", token), ctx(id)));
const callPatch = async (token: string | undefined, id: string, body: unknown) =>
  read(await PATCH(request("PATCH", token, body), ctx(id)));

function seedTask(id: string, fields: Record<string, unknown> = {}) {
  const at = Timestamp.fromDate(new Date("2026-09-20T10:00:00Z"));
  fakeAdmin.collection("tasks").set(id, {
    title: "Seeded",
    type: "resume",
    description: "d",
    dueAt: at,
    status: "draft",
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: at,
    updatedAt: at,
    ...fields,
  });
}

beforeEach(() => {
  fakeAdmin.reset();
  recomputeMock.mockClear();
  const user = (role: string) => ({ name: role, email: `${role}@college.ac.in`, role, onboarded: true, showOnLeaderboard: false });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("student", { uid: "s1", email: "stu@college.ac.in", email_verified: true });
  fakeAdmin.users.set("m1", user("mentor"));
  fakeAdmin.users.set("v1", user("viewer"));
  fakeAdmin.users.set("s1", { ...user("student"), rollNo: "ABC123", branch: "CSE" });
  seedTask("t1");
});

describe("task API authorisation", () => {
  it("401s every endpoint without a token", async () => {
    expect((await callList()).status).toBe(401);
    expect((await callCreate(undefined, resumeTask)).status).toBe(401);
    expect((await callGet(undefined, "t1")).status).toBe(401);
    expect((await callPatch(undefined, "t1", { status: "published" })).status).toBe(401);
  });

  it("403s students on every endpoint (they read published tasks from Firestore instead)", async () => {
    expect((await callList("student")).status).toBe(403);
    expect((await callCreate("student", resumeTask)).status).toBe(403);
    expect((await callGet("student", "t1")).status).toBe(403);
    expect((await callPatch("student", "t1", { status: "published" })).status).toBe(403);
    expect(fakeAdmin.collection("tasks").size).toBe(1);
    expect(fakeAdmin.collection("tasks").get("t1")).toMatchObject({ status: "draft" });
  });

  it("lets viewers read but 403s their writes", async () => {
    expect((await callList("viewer")).status).toBe(200);
    expect((await callGet("viewer", "t1")).status).toBe(200);
    expect((await callCreate("viewer", resumeTask)).status).toBe(403);
    expect((await callPatch("viewer", "t1", { status: "published" })).status).toBe(403);
    expect(fakeAdmin.collection("tasks").get("t1")).toMatchObject({ status: "draft" });
  });

  it("lets mentors read and write", async () => {
    expect((await callList("mentor")).status).toBe(200);
    expect((await callGet("mentor", "t1")).status).toBe(200);
    expect((await callCreate("mentor", resumeTask)).status).toBe(201);
    expect((await callPatch("mentor", "t1", { status: "published" })).status).toBe(200);
  });
});

describe("POST /api/tasks", () => {
  it("creates a draft with defaults, createdBy from the token, and Firestore timestamps", async () => {
    const { status, body } = await callCreate("mentor", codingTask);
    expect(status).toBe(201);
    expect(body.task).toMatchObject({
      title: "Two sum",
      type: "coding",
      status: "draft",
      maxAttempts: 5,
      createdBy: "m1",
      dueAt: "2026-10-05T18:29:00.000Z",
      coding,
    });
    const stored = fakeAdmin.collection("tasks").get(body.task?.id ?? "");
    expect(stored?.dueAt).toBeInstanceOf(Timestamp);
    expect(stored).toMatchObject({ createdBy: "m1", coding });
  });

  it("does not store a coding field for non-coding tasks", async () => {
    const { body } = await callCreate("mentor", resumeTask);
    expect(fakeAdmin.collection("tasks").get(body.task?.id ?? "")).not.toHaveProperty("coding");
  });

  it("400s invalid tasks with the validation message", async () => {
    const bad = await callCreate("mentor", { ...codingTask, coding: { ...coding, problemSlug: "Two Sum" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("kebab");
    expect((await callCreate("mentor", { ...codingTask, coding: { ...coding, hiddenTests: [] } })).status).toBe(400);
    expect((await callCreate("mentor", { ...resumeTask, createdBy: "someone-else" })).status).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("lists drafts and published tasks, latest due date first, with ISO dates", async () => {
    seedTask("t2", { status: "published", dueAt: Timestamp.fromDate(new Date("2026-10-01T00:00:00Z")) });
    const { body } = await callList("viewer");
    expect(body.tasks?.map((task) => [task.id, task.status])).toEqual([
      ["t2", "published"],
      ["t1", "draft"],
    ]);
    expect(body.tasks?.[0]?.dueAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("skips malformed task docs instead of failing the whole list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeAdmin.collection("tasks").set("broken", { title: "no other fields" });
    const { status, body } = await callList("mentor");
    expect(status).toBe(200);
    expect(body.tasks?.map((task) => task.id)).toEqual(["t1"]);
  });
});

describe("GET/PATCH /api/tasks/[id]", () => {
  it("404s unknown or malformed ids", async () => {
    expect((await callGet("mentor", "nope")).status).toBe(404);
    expect((await callGet("mentor", "a.b")).status).toBe(404);
    expect((await callPatch("mentor", "nope", { status: "published" })).status).toBe(404);
  });

  it("publishes and unpublishes", async () => {
    expect((await callPatch("mentor", "t1", { status: "published" })).body.task?.status).toBe("published");
    expect(fakeAdmin.collection("tasks").get("t1")).toMatchObject({ status: "published" });
    expect((await callPatch("mentor", "t1", { status: "draft" })).body.task?.status).toBe("draft");
  });

  it("edits fields and keeps createdBy and createdAt", async () => {
    const before = fakeAdmin.collection("tasks").get("t1");
    const { body } = await callPatch("mentor", "t1", { title: "New title", maxAttempts: 4 });
    expect(body.task).toMatchObject({ title: "New title", maxAttempts: 4, createdBy: "m1" });
    const after = fakeAdmin.collection("tasks").get("t1");
    expect(after?.createdAt).toEqual(before?.createdAt);
    expect(after?.updatedAt).not.toEqual(before?.updatedAt);
  });

  it("re-validates the merged task: switching to coding requires coding settings", async () => {
    const bad = await callPatch("mentor", "t1", { type: "coding" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Coding tasks need coding settings.");
    expect((await callPatch("mentor", "t1", { type: "coding", coding })).body.task).toMatchObject({ type: "coding", coding });
  });

  it("drops coding settings when a coding task becomes another type", async () => {
    seedTask("c1", { type: "coding", coding, maxAttempts: 5 });
    const { status, body } = await callPatch("mentor", "c1", { type: "intro_written" });
    expect(status).toBe(200);
    expect(body.task).not.toHaveProperty("coding");
    expect(fakeAdmin.collection("tasks").get("c1")).not.toHaveProperty("coding");
  });

  it("400s patches with unknown fields and leaves the task unchanged", async () => {
    expect((await callPatch("mentor", "t1", { createdBy: "evil" })).status).toBe(400);
    expect((await callPatch("mentor", "t1", {})).status).toBe(400);
    expect(fakeAdmin.collection("tasks").get("t1")).toMatchObject({ createdBy: "m1", title: "Seeded" });
  });
});

describe("stats recompute after task changes", () => {
  it("recomputes after creating a published task, not a draft", async () => {
    expect((await callCreate("mentor", resumeTask)).status).toBe(201);
    expect(recomputeMock).not.toHaveBeenCalled();
    const { status, body } = await callCreate("mentor", { ...resumeTask, status: "published" });
    expect(status).toBe(201);
    expect(recomputeMock).toHaveBeenCalledExactlyOnceWith(`POST /api/tasks (${body.task?.id})`);
  });

  it("recomputes when status, due date or type changes", async () => {
    await callPatch("mentor", "t1", { status: "published" });
    await callPatch("mentor", "t1", { dueAt: "2026-10-20T23:59:00+05:30" });
    await callPatch("mentor", "t1", { type: "intro_written" });
    expect(recomputeMock).toHaveBeenCalledTimes(3);
    expect(recomputeMock).toHaveBeenCalledWith("PATCH /api/tasks/t1");
  });

  it("does not recompute for other edits, unchanged values, or refused patches", async () => {
    await callPatch("mentor", "t1", { title: "New title", description: "New", maxAttempts: 2 });
    await callPatch("mentor", "t1", { status: "draft", dueAt: "2026-09-20T10:00:00Z", type: "resume" });
    await callPatch("mentor", "t1", { type: "coding" }); // 400: missing coding settings
    await callPatch("viewer", "t1", { status: "published" }); // 403
    await callPatch("mentor", "nope", { status: "published" }); // 404
    expect(recomputeMock).not.toHaveBeenCalled();
  });
});
