import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recomputeAll, recomputeStudent, recomputeTask } from "@/lib/stats/recompute";
import { onFinished } from "@/lib/submissions/onFinished";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);

const now = new Date("2026-10-10T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const ts = (days: number) => Timestamp.fromDate(new Date(now.getTime() + days * day));

function user(uid: string, fields: Record<string, unknown> = {}) {
  fakeAdmin.users.set(uid, {
    name: uid.toUpperCase(),
    email: `${uid}@college.ac.in`,
    role: "student",
    onboarded: true,
    rollNo: `0827${uid.toUpperCase()}`,
    branch: "CSE",
    showOnLeaderboard: false,
    ...fields,
  });
}

function task(id: string, dueInDays: number, status = "published", type = "coding") {
  fakeAdmin.collection("tasks").set(id, {
    title: id,
    type,
    description: "d",
    dueAt: ts(dueInDays),
    status,
    maxAttempts: 5,
    createdBy: "m1",
    createdAt: ts(-30),
    updatedAt: ts(-30),
  });
}

let subId = 0;
function submission(uid: string, taskId: string, status: string, score?: number, daysAgo = 1) {
  fakeAdmin.collection("submissions").set(`sub${++subId}`, {
    taskId,
    uid,
    type: "coding",
    attempt: 1,
    createdAt: ts(-daysAgo),
    status,
    content: "code",
    ...(score === undefined
      ? {}
      : { result: { score, summary: "s", strengths: [], improvements: [], nextSteps: [] } }),
  });
}

const studentStats = (uid: string) => fakeAdmin.collection("studentStats").get(uid);
const taskStats = (id: string) => fakeAdmin.collection("taskStats").get(id);

beforeEach(() => {
  fakeAdmin.reset();
  subId = 0;
  user("s1");
  user("s2", { branch: "IT" });
  user("s3", { onboarded: false, rollNo: undefined, branch: undefined });
  user("m1", { role: "mentor", rollNo: undefined, branch: undefined });
  task("past", -2);
  task("future", 3);
  task("draft", -2, "draft");
  submission("s1", "past", "done", 6, 3);
  submission("s1", "past", "done", 8, 2);
  submission("s1", "future", "error");
  submission("s2", "future", "done", 9);
  submission("s1", "draft", "done", 10);
});

describe("recomputeStudent", () => {
  it("writes the student's stats from their own submissions and published tasks", async () => {
    expect(await recomputeStudent("s1", now)).toBe(true);
    expect(studentStats("s1")).toMatchObject({
      name: "S1",
      rollNo: "0827S1",
      branch: "CSE",
      tasksDue: 1,
      tasksSubmitted: 1,
      missedCount: 0,
      avgBySkill: { coding: 8 },
      overallAvg: 8,
      recentScores: [{ taskId: "past", type: "coding", score: 8, at: ts(-2).toDate() }],
      needsAttention: false,
    });
    expect(studentStats("s1")?.updatedAt).toEqual(Timestamp.fromDate(now));
  });

  it("writes nothing for staff, not-onboarded or unknown users", async () => {
    for (const uid of ["m1", "s3", "nobody"]) {
      expect(await recomputeStudent(uid, now)).toBe(false);
      expect(studentStats(uid)).toBeUndefined();
    }
  });
});

describe("recomputeTask", () => {
  it("writes counts, the not-submitted list and averages for a published task", async () => {
    await recomputeTask("future", now);
    expect(taskStats("future")).toEqual({
      submittedCount: 1,
      notSubmittedUids: ["s1"],
      avgScore: 9,
      avgScoreByBranch: { IT: 9 },
      updatedAt: Timestamp.fromDate(now),
    });
  });

  it("deletes the stats of a draft or missing task", async () => {
    fakeAdmin.collection("taskStats").set("draft", { stale: true });
    fakeAdmin.collection("taskStats").set("gone", { stale: true });
    await recomputeTask("draft", now);
    await recomputeTask("gone", now);
    expect(taskStats("draft")).toBeUndefined();
    expect(taskStats("gone")).toBeUndefined();
  });
});

describe("recomputeAll", () => {
  it("writes every onboarded student's and every published task's stats, and removes draft task stats", async () => {
    fakeAdmin.collection("taskStats").set("draft", { stale: true });
    expect(await recomputeAll(now)).toEqual({ students: 2, tasks: 2 });
    expect([...fakeAdmin.collection("studentStats").keys()].sort()).toEqual(["s1", "s2"]);
    expect([...fakeAdmin.collection("taskStats").keys()].sort()).toEqual(["future", "past"]);
    expect(studentStats("s2")).toMatchObject({ tasksDue: 1, missedCount: 1, tasksSubmitted: 1, overallAvg: 9 });
    expect(taskStats("past")).toMatchObject({ submittedCount: 1, notSubmittedUids: ["s2"], avgScore: 8 });
  });

  it("gives the same docs as the single recomputes, and the same docs when run twice (idempotent)", async () => {
    await recomputeStudent("s1", now);
    await recomputeTask("past", now);
    const single = { s1: studentStats("s1"), past: taskStats("past") };
    await recomputeAll(now);
    const first = new Map(fakeAdmin.collection("studentStats"));
    const firstTasks = new Map(fakeAdmin.collection("taskStats"));
    await recomputeAll(now);
    expect({ s1: studentStats("s1"), past: taskStats("past") }).toEqual(single);
    expect(new Map(fakeAdmin.collection("studentStats"))).toEqual(first);
    expect(new Map(fakeAdmin.collection("taskStats"))).toEqual(firstTasks);
  });

  it("skips malformed docs instead of failing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeAdmin.users.set("broken", { name: 1 });
    fakeAdmin.collection("tasks").set("broken", { title: "no fields" });
    fakeAdmin.collection("submissions").set("broken", { uid: "s2" });
    expect(await recomputeAll(now)).toEqual({ students: 2, tasks: 2 });
    expect(studentStats("s2")).toMatchObject({ tasksSubmitted: 1 });
    error.mockRestore();
  });
});

describe("onFinished", () => {
  it("recomputes the submitting student's stats and the task's stats", async () => {
    await onFinished({ submissionId: "sub2", uid: "s1", taskId: "past" });
    expect(studentStats("s1")).toMatchObject({ tasksSubmitted: 1, overallAvg: 8 });
    expect(taskStats("past")).toMatchObject({ submittedCount: 1, notSubmittedUids: ["s2"] });
    expect(studentStats("s2")).toBeUndefined();
    expect(taskStats("future")).toBeUndefined();
  });
});
