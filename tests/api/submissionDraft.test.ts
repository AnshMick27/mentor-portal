import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/submissions/draft/route";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

const DAY = 24 * 60 * 60 * 1000;

function user(role: "student" | "mentor" | "viewer") {
  return { name: "Stu", email: "stu@college.ac.in", role, onboarded: true, showOnLeaderboard: false };
}

function task(type: string, status = "published") {
  const now = Timestamp.now();
  return {
    title: "T",
    type,
    description: "Do it.",
    dueAt: Timestamp.fromMillis(Date.now() + DAY),
    status,
    maxAttempts: 2,
    createdBy: "m1",
    createdAt: now,
    updatedAt: now,
    ...(type === "coding"
      ? { coding: { problemSlug: "sum-two-numbers", languages: ["python"], sampleTests: [{ input: "1 2", output: "3" }], timeLimitMs: 2000 } }
      : {}),
  };
}

async function post(token: string | undefined, body: unknown): Promise<number> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await POST(new Request("http://localhost/api/submissions/draft", { method: "POST", headers, body: JSON.stringify(body) }));
  return response.status;
}

const drafts = () => fakeAdmin.collection("drafts");

beforeEach(() => {
  fakeAdmin.reset();
  fakeAdmin.tokens.set("stu", { uid: "s1", email: "stu@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.users.set("s1", user("student"));
  fakeAdmin.users.set("m1", user("mentor"));
  fakeAdmin.collection("tasks").set("code1", task("coding"));
  fakeAdmin.collection("tasks").set("intro1", task("intro_written"));
  fakeAdmin.collection("tasks").set("resume1", task("resume"));
  fakeAdmin.collection("tasks").set("draft1", task("coding", "draft"));
});

describe("POST /api/submissions/draft (T46b)", () => {
  it("starts the clock for a code or intro task, and restarts it when the form opens again", async () => {
    expect(await post("stu", { taskId: "code1" })).toBe(204);
    expect(await post("stu", { taskId: "intro1" })).toBe(204);
    const first = drafts().get("s1_code1") as { uid: string; taskId: string; openedAt: Timestamp };
    expect(first).toMatchObject({ uid: "s1", taskId: "code1" });
    expect(Math.abs(first.openedAt.toMillis() - Date.now())).toBeLessThan(5_000);
    expect(drafts().get("s1_intro1")).toBeDefined();
  });

  it("refuses a resume task, a draft task and an unknown task", async () => {
    expect(await post("stu", { taskId: "resume1" })).toBe(400);
    expect(await post("stu", { taskId: "draft1" })).toBe(404);
    expect(await post("stu", { taskId: "nope1" })).toBe(404);
    expect(drafts().size).toBe(0);
  });

  it("is for students only and validates the body strictly", async () => {
    expect(await post(undefined, { taskId: "code1" })).toBe(401);
    expect(await post("mentor", { taskId: "code1" })).toBe(403);
    expect(await post("stu", { taskId: "code1", openedAt: 0 })).toBe(400);
    expect(drafts().size).toBe(0);
  });
});
