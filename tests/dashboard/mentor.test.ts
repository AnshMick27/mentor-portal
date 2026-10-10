import { describe, expect, it } from "vitest";
import {
  branchesOf,
  taskPhase,
  classSkillAverages,
  inBranch,
  needsAttentionList,
  taskStatusRows,
  type MentorStudent,
} from "@/lib/dashboard/mentor";
import type { StoredTaskStats } from "@/lib/validation/stats";
import type { TaskDto } from "@/lib/validation/task";
import type { Branch } from "@/lib/validation/user";

const ts = { toDate: () => new Date("2026-10-01T00:00:00Z") };
/** Before the due date of `task()` (30 Sep 2026, 11:59 pm IST). */
const NOW = new Date("2026-09-25T00:00:00Z");

function student(uid: string, name: string, branch: Branch, extra: Partial<MentorStudent> = {}): MentorStudent {
  return {
    uid,
    name,
    rollNo: `R-${uid}`,
    branch,
    tasksDue: 0,
    tasksSubmitted: 0,
    missedCount: 0,
    avgBySkill: {},
    recentScores: [],
    latestNextSteps: [],
    needsAttention: false,
    showOnLeaderboard: false,
    updatedAt: ts,
    ...extra,
  };
}

function task(id: string): TaskDto {
  return {
    id,
    title: id,
    type: "coding",
    description: "",
    dueAt: "2026-09-30T18:29:00.000Z",
    status: "published",
    maxAttempts: 5,
    createdBy: "m1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const students = [
  student("s1", "Zara", "CSE", { avgBySkill: { coding: 9, resume: 6 }, needsAttention: true, needsAttentionReason: "Missed 2 of the last 4 tasks" }),
  student("s2", "Arjun", "IT", { avgBySkill: { coding: 4 }, needsAttention: true, needsAttentionReason: "Average of the last 3 scores is 4" }),
  student("s3", "Meera", "CSE", { avgBySkill: { coding: 7.5 } }),
  student("s4", "Kabir", "IT"),
];

const stats = (fields: Partial<StoredTaskStats>): StoredTaskStats => ({
  submittedCount: 0,
  notSubmittedUids: [],
  avgScoreByBranch: {},
  updatedAt: ts,
  ...fields,
});

describe("branch helpers", () => {
  it("filters by branch and lists only branches that have students, in the usual order", () => {
    expect(inBranch(students, "all")).toHaveLength(4);
    expect(inBranch(students, "IT").map((s) => s.uid)).toEqual(["s2", "s4"]);
    expect(inBranch(students, "EC")).toEqual([]);
    expect(branchesOf(students)).toEqual(["CSE", "IT"]);
  });
});

describe("taskStatusRows", () => {
  const statsByTask = new Map([
    ["t1", stats({ submittedCount: 2, notSubmittedUids: ["s4", "s3", "ghost"], avgScore: 6.5, avgScoreByBranch: { CSE: 9, IT: 4 } })],
  ]);

  it("counts submitted vs not for the whole class, joins names and sorts them, skips unknown uids", () => {
    const [row] = taskStatusRows([task("t1")], statsByTask, students, "all", NOW);
    expect(row).toMatchObject({ total: 4, submitted: 2, average: 6.5, hasStats: true });
    expect(row?.notSubmitted).toEqual([
      { uid: "s4", name: "Kabir", rollNo: "R-s4" },
      { uid: "s3", name: "Meera", rollNo: "R-s3" },
    ]);
  });

  it("narrows counts, non-submitters and the average to one branch", () => {
    const [cse] = taskStatusRows([task("t1")], statsByTask, students, "CSE", NOW);
    expect(cse).toMatchObject({ total: 2, submitted: 1, average: 9 });
    expect(cse?.notSubmitted.map((s) => s.uid)).toEqual(["s3"]);
    const [ec] = taskStatusRows([task("t1")], statsByTask, students, "EC", NOW);
    expect(ec).toMatchObject({ total: 0, submitted: 0, notSubmitted: [] });
    expect(ec?.average).toBeUndefined();
  });

  it("marks tasks without a stats doc and keeps the given task order", () => {
    const rows = taskStatusRows([task("t2"), task("t1")], statsByTask, students, "all", NOW);
    expect(rows.map((r) => [r.task.id, r.hasStats])).toEqual([
      ["t2", false],
      ["t1", true],
    ]);
  });
});

describe("taskPhase (T51)", () => {
  const due = Date.parse(task("t").dueAt);
  const day = 24 * 60 * 60 * 1000;

  it("is open up to the due date, late until the cutoff (default 7 days), then closed", () => {
    expect(taskPhase(task("t"), new Date(due))).toBe("open");
    expect(taskPhase(task("t"), new Date(due + 1))).toBe("late");
    expect(taskPhase(task("t"), new Date(due + 7 * day))).toBe("late");
    expect(taskPhase(task("t"), new Date(due + 7 * day + 1))).toBe("closed");
  });

  it("uses the mentor's lateUntil", () => {
    const custom = { ...task("t"), lateUntil: new Date(due + day).toISOString() };
    expect(taskPhase(custom, new Date(due + day + 1))).toBe("closed");
  });

  it("puts closed tasks after open and late ones, each group in the given order", () => {
    const now = new Date(Date.parse("2026-10-10T00:00:00Z"));
    const tasks = [
      { ...task("open"), dueAt: "2026-10-15T18:29:00.000Z" },
      { ...task("closed-new"), dueAt: "2026-10-01T18:29:00.000Z", lateUntil: "2026-10-02T18:29:00.000Z" },
      { ...task("late"), dueAt: "2026-10-05T18:29:00.000Z" },
      { ...task("closed-old"), dueAt: "2026-09-20T18:29:00.000Z" },
    ];
    const rows = taskStatusRows(tasks, new Map(), students, "all", now);
    expect(rows.map((r) => [r.task.id, r.phase])).toEqual([
      ["open", "open"],
      ["late", "late"],
      ["closed-new", "closed"],
      ["closed-old", "closed"],
    ]);
  });
});

describe("needsAttentionList", () => {
  it("lists flagged students by name with their reason, per branch", () => {
    expect(needsAttentionList(students, "all").map((s) => [s.name, s.reason])).toEqual([
      ["Arjun", "Average of the last 3 scores is 4"],
      ["Zara", "Missed 2 of the last 4 tasks"],
    ]);
    expect(needsAttentionList(students, "CSE").map((s) => s.uid)).toEqual(["s1"]);
  });
});

describe("classSkillAverages", () => {
  it("averages the students' own skill averages (each student once) and counts them", () => {
    expect(classSkillAverages(students, "all")).toEqual([
      { type: "coding", label: "Coding", average: 6.8, students: 3 }, // (9 + 4 + 7.5) / 3 = 6.83
      { type: "resume", label: "Resume", average: 6, students: 1 },
      { type: "intro_written", label: "Written intro", students: 0 },
      { type: "scenario", label: "Scenario", students: 0 },
    ]);
    expect(classSkillAverages(students, "IT")[0]).toEqual({ type: "coding", label: "Coding", average: 4, students: 1 });
  });
});
