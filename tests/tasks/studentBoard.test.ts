import { describe, expect, it } from "vitest";
import type { SubmissionLike } from "@/lib/submissions/scoring";
import { groupStudentTasks, publishedOnly, summarizeByTask, taskProgress } from "@/lib/tasks/studentBoard";
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

function sub(taskId: string, status: SubmissionLike["status"], score?: number, minutesAgo = 1) {
  const createdAt = new Date(now.getTime() - minutesAgo * 60_000);
  const base = { taskId, status, createdAt };
  return score === undefined ? base : { ...base, result: { score } };
}

describe("taskProgress / summarizeByTask", () => {
  it("counts attempts without errors or timed-out ones, and keeps the best finished score", () => {
    const list = [
      sub("a", "done", 6.5),
      sub("a", "done", 8),
      sub("a", "error"),
      sub("a", "running", undefined, 11),
      sub("a", "running"),
    ];
    expect(taskProgress(list, now)).toEqual({ attemptsUsed: 3, bestScore: 8 });
  });

  it("has no best score until an attempt is finished", () => {
    expect(taskProgress([sub("a", "running")], now)).toEqual({ attemptsUsed: 1 });
    expect(taskProgress([], now)).toEqual({ attemptsUsed: 0 });
  });

  it("groups progress per task id", () => {
    const progress = summarizeByTask([sub("a", "done", 7), sub("b", "error"), sub("a", "done", 4)], now);
    expect(Object.fromEntries(progress)).toEqual({ a: { attemptsUsed: 2, bestScore: 7 }, b: { attemptsUsed: 0 } });
  });
});

describe("groupStudentTasks", () => {
  it("never shows drafts in any group", () => {
    const board = groupStudentTasks(tasks, new Map([["draft-future", { attemptsUsed: 1 }]]), now);
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

  it("puts closed or used-up tasks with a counted attempt under Submitted, with attempts used and best score", () => {
    const progress = new Map([
      ["soon", { attemptsUsed: 3, bestScore: 7.5 }],
      ["missed-old", { attemptsUsed: 1 }],
      ["missed-recent", { attemptsUsed: 0 }],
    ]);
    const board = groupStudentTasks(tasks, progress, now);
    expect(ids(board.submitted)).toEqual(["soon", "missed-old"]);
    expect(board.submitted[0]).toMatchObject({ attemptsUsed: 3, bestScore: 7.5 });
    expect(ids(board.dueSoon)).toEqual(["later"]);
    expect(board.dueSoon[0]?.attemptsUsed).toBe(0);
    expect(ids(board.missed)).toEqual(["missed-recent"]);
  });

  it("keeps submitted tasks that are still open with attempts left in Due soon (T42)", () => {
    const progress = new Map([
      ["soon", { attemptsUsed: 1, bestScore: 6 }], // open, 2 tries left → can improve
      ["later", { attemptsUsed: 3, bestScore: 9 }], // open, no tries left
      ["missed-old", { attemptsUsed: 1, bestScore: 5 }], // closed
    ]);
    const board = groupStudentTasks(tasks, progress, now);
    expect(ids(board.dueSoon)).toEqual(["soon"]);
    expect(board.dueSoon[0]).toMatchObject({ attemptsUsed: 1, bestScore: 6 });
    expect(ids(board.submitted)).toEqual(["later", "missed-old"]);
    expect(ids(board.missed)).toEqual(["missed-recent"]);
  });

  it("orders Due soon by due date whether or not a task was submitted (T42)", () => {
    const board = groupStudentTasks(tasks, new Map([["later", { attemptsUsed: 1 }]]), now);
    expect(ids(board.dueSoon)).toEqual(["soon", "later"]);
  });

  it("treats a task due exactly now as still due", () => {
    const board = groupStudentTasks([task("edge", now.toISOString())], new Map(), now);
    expect(ids(board.dueSoon)).toEqual(["edge"]);
  });
});

describe("late attempts on the board (T44)", () => {
  const late = (score?: number): SubmissionLike => ({
    status: "done",
    createdAt: now,
    late: true,
    ...(score === undefined ? {} : { result: { score } }),
  });

  it("marks progress lateOnly when every counted attempt was late, with no best score", () => {
    expect(taskProgress([late(9)], now)).toEqual({ attemptsUsed: 1, lateOnly: true });
    expect(taskProgress([late(9), { status: "done", createdAt: now, result: { score: 4 } }], now)).toEqual({ attemptsUsed: 2, bestScore: 4 });
  });

  it("keeps a past-due task with only late work under Missed", () => {
    const board = groupStudentTasks(tasks, new Map([["missed-recent", { attemptsUsed: 1, lateOnly: true as const }]]), now);
    expect(ids(board.missed)).toEqual(["missed-recent", "missed-old"]);
    expect(ids(board.submitted)).toEqual([]);
  });
});
