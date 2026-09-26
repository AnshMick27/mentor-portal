import { describe, expect, it } from "vitest";
import { countAttempts, groupStudentTasks, publishedOnly } from "@/lib/tasks/studentBoard";
import type { TaskDto } from "@/lib/validation/task";

const now = new Date("2026-10-01T12:00:00+05:30");

function task(id: string, dueAt: string, status: TaskDto["status"] = "published"): TaskDto {
  return {
    id,
    title: id,
    type: "resume",
    description: "d",
    dueAt,
    status,
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const tasks = [
  task("later", "2026-10-10T10:00:00+05:30"),
  task("soon", "2026-10-02T10:00:00+05:30"),
  task("missed-old", "2026-09-10T10:00:00+05:30"),
  task("missed-recent", "2026-09-30T10:00:00+05:30"),
  task("draft-future", "2026-10-05T10:00:00+05:30", "draft"),
  task("draft-past", "2026-09-05T10:00:00+05:30", "draft"),
];

const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe("publishedOnly", () => {
  it("drops drafts", () => {
    expect(ids(publishedOnly(tasks))).toEqual(["later", "soon", "missed-old", "missed-recent"]);
  });
});

describe("countAttempts", () => {
  it("counts submissions per task", () => {
    const counts = countAttempts([{ taskId: "a" }, { taskId: "b" }, { taskId: "a" }]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 });
  });
});

describe("groupStudentTasks", () => {
  it("never shows drafts in any group", () => {
    const board = groupStudentTasks(tasks, new Map([["draft-future", 1]]), now);
    const all = [...board.dueSoon, ...board.submitted, ...board.missed];
    expect(ids(all)).not.toContain("draft-future");
    expect(ids(all)).not.toContain("draft-past");
  });

  it("with no submissions, splits into Due soon (soonest first) and Missed (most recent first)", () => {
    const board = groupStudentTasks(tasks, new Map(), now);
    expect(ids(board.dueSoon)).toEqual(["soon", "later"]);
    expect(ids(board.submitted)).toEqual([]);
    expect(ids(board.missed)).toEqual(["missed-recent", "missed-old"]);
  });

  it("puts tasks with at least one attempt under Submitted, with attempts used", () => {
    const board = groupStudentTasks(tasks, new Map([["soon", 2], ["missed-old", 1]]), now);
    expect(ids(board.submitted)).toEqual(["soon", "missed-old"]);
    expect(board.submitted[0]?.attemptsUsed).toBe(2);
    expect(ids(board.dueSoon)).toEqual(["later"]);
    expect(board.dueSoon[0]?.attemptsUsed).toBe(0);
    expect(ids(board.missed)).toEqual(["missed-recent"]);
  });

  it("treats a task due exactly now as still due", () => {
    const board = groupStudentTasks([task("edge", now.toISOString())], new Map(), now);
    expect(ids(board.dueSoon)).toEqual(["edge"]);
  });
});
