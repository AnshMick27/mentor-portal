import { describe, expect, it } from "vitest";
import { dashboardNextSteps, skillAverages, tasksThisWeek, WEEK_MS } from "@/lib/dashboard/student";
import type { TaskDto } from "@/lib/validation/task";

const now = new Date("2026-10-01T12:00:00Z");
const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();
const HOUR = 60 * 60 * 1000;

function task(id: string, dueAt: string, status: TaskDto["status"] = "published"): TaskDto {
  return {
    id,
    title: id,
    type: "resume",
    description: "",
    dueAt,
    status,
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("tasksThisWeek", () => {
  it("keeps published tasks due from now up to exactly 7 days ahead, soonest first", () => {
    const tasks = [
      task("in-3-days", iso(72 * HOUR)),
      task("exactly-now", iso(0)),
      task("exactly-7-days", iso(WEEK_MS)),
      task("just-past", iso(-1)),
      task("7-days-and-1ms", iso(WEEK_MS + 1)),
      task("draft", iso(HOUR), "draft"),
    ];
    expect(tasksThisWeek(tasks, new Map(), now).map((t) => t.id)).toEqual(["exactly-now", "in-3-days", "exactly-7-days"]);
  });

  it("adds the student's progress, defaulting to no attempts", () => {
    const tasks = [task("a", iso(HOUR)), task("b", iso(2 * HOUR))];
    const progress = new Map([["a", { attemptsUsed: 2, bestScore: 7.5 }]]);
    expect(tasksThisWeek(tasks, progress, now).map(({ id, attemptsUsed, bestScore }) => ({ id, attemptsUsed, bestScore }))).toEqual([
      { id: "a", attemptsUsed: 2, bestScore: 7.5 },
      { id: "b", attemptsUsed: 0, bestScore: undefined },
    ]);
  });
});

describe("skillAverages", () => {
  it("lists only skills with a score, in task-type order, with labels", () => {
    expect(skillAverages({ avgBySkill: { intro_written: 6, coding: 8.5 } })).toEqual([
      { type: "coding", label: "Coding", average: 8.5 },
      { type: "intro_written", label: "Written intro", average: 6 },
    ]);
  });

  it("is empty without stats or scores (a brand-new student)", () => {
    expect(skillAverages(undefined)).toEqual([]);
    expect(skillAverages({ avgBySkill: {} })).toEqual([]);
  });
});

describe("dashboardNextSteps", () => {
  it("returns at most 3 steps and nothing without stats", () => {
    expect(dashboardNextSteps({ latestNextSteps: ["a", "b", "c", "d"] })).toEqual(["a", "b", "c"]);
    expect(dashboardNextSteps(undefined)).toEqual([]);
  });
});
