import { describe, expect, it } from "vitest";
import { attemptsOnOtherTasks, isValidUid, profileTaskRows } from "@/lib/dashboard/profile";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

const now = new Date("2026-10-01T12:00:00Z");
const DAY = 86_400_000;

function task(id: string, dueInDays: number, status: TaskDto["status"] = "published"): TaskDto {
  return {
    id,
    title: id,
    type: "resume",
    description: "",
    dueAt: new Date(now.getTime() + dueInDays * DAY).toISOString(),
    status,
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function sub(id: string, taskId: string, status: SubmissionView["status"], daysAgo: number, score?: number): SubmissionView {
  return {
    id,
    taskId,
    uid: "s1",
    type: "resume",
    attempt: 1,
    createdAt: new Date(now.getTime() - daysAgo * DAY),
    status,
    content: "text",
    ...(score === undefined ? {} : { result: { score, summary: "", strengths: [], improvements: [], nextSteps: [] } }),
  };
}

describe("isValidUid", () => {
  it("accepts Firebase-style and seed ids, refuses anything that could be a path", () => {
    expect(isValidUid("aZ09_-x")).toBe(true);
    expect(isValidUid("seed-student-1")).toBe(true);
    for (const bad of ["", "a/b", "../x", "a b", "x".repeat(129)]) expect(isValidUid(bad)).toBe(false);
  });
});

describe("profileTaskRows", () => {
  const tasks = [task("old", -10), task("future", 3), task("recent", -1), task("draft", -2, "draft")];
  const subs = [
    sub("a1", "old", "done", 12, 6),
    sub("a2", "old", "done", 11, 8),
    sub("a3", "old", "error", 10.5),
    sub("b1", "recent", "error", 2),
    sub("c1", "draft", "done", 3, 9),
  ];

  it("lists published tasks only, latest due date first", () => {
    expect(profileTaskRows(tasks, subs, now).map((r) => r.task.id)).toEqual(["future", "recent", "old"]);
  });

  it("groups each task's attempts newest first, with attempts used (no errors), best score and state", () => {
    const rows = new Map(profileTaskRows(tasks, subs, now).map((r) => [r.task.id, r]));
    expect(rows.get("old")).toMatchObject({ attemptsUsed: 2, bestScore: 8, state: "submitted" });
    expect(rows.get("old")?.attempts.map((s) => s.id)).toEqual(["a3", "a2", "a1"]);
    expect(rows.get("recent")).toMatchObject({ attemptsUsed: 0, state: "missed" }); // only an error attempt
    expect(rows.get("recent")?.bestScore).toBeUndefined();
    expect(rows.get("future")).toMatchObject({ attempts: [], attemptsUsed: 0, state: "open" });
  });

  it("counts attempts on tasks that are not published", () => {
    expect(attemptsOnOtherTasks(tasks, subs)).toBe(1);
    expect(attemptsOnOtherTasks([], subs)).toBe(5);
  });
});
