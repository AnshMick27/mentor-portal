import { describe, expect, it } from "vitest";
import {
  averageScore,
  computeStudentStats,
  computeTaskStats,
  countedStudents,
  isPastDue,
} from "@/lib/stats/compute";
import type { StatsSubmission, StatsTask, StatsUser } from "@/lib/stats/types";
import type { TaskType } from "@/lib/validation/task";

const now = new Date("2026-10-10T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(now.getTime() + days * day);

function task(id: string, dueInDays: number, type: TaskType = "coding", status: StatsTask["status"] = "published"): StatsTask {
  return { id, type, status, dueAt: at(dueInDays) };
}

const stu: StatsUser = { uid: "s1", name: "Asha", role: "student", onboarded: true, rollNo: "0827CS1", branch: "CSE" };

function done(taskId: string, score: number, daysAgo = 1, nextSteps: string[] = [], uid = "s1"): StatsSubmission {
  return { taskId, uid, status: "done", createdAt: at(-daysAgo), result: { score, nextSteps } };
}

function other(taskId: string, status: StatsSubmission["status"], uid = "s1"): StatsSubmission {
  return { taskId, uid, status, createdAt: at(-1) };
}

describe("averageScore", () => {
  it("is undefined for no scores and exact to one decimal otherwise", () => {
    expect(averageScore([])).toBeUndefined();
    expect(averageScore([7])).toBe(7);
    expect(averageScore([0.1, 0.2])).toBe(0.2); // 0.15 → rounds half up without float drift
    expect(averageScore([4.4, 4.5])).toBe(4.5); // 4.45
    expect(averageScore([10, 9.9, 9.9])).toBe(9.9); // 9.933…
  });
});

describe("isPastDue", () => {
  it("is false at exactly the due time and true one millisecond later", () => {
    const t = { id: "t", type: "coding" as const, status: "published" as const, dueAt: now };
    expect(isPastDue(t, now)).toBe(false);
    expect(isPastDue(t, new Date(now.getTime() + 1))).toBe(true);
  });
});

describe("computeStudentStats — counting", () => {
  it("starts empty for a student with no tasks", () => {
    expect(computeStudentStats(stu, [], [], now)).toEqual({
      name: "Asha",
      rollNo: "0827CS1",
      branch: "CSE",
      tasksDue: 0,
      tasksSubmitted: 0,
      missedCount: 0,
      avgBySkill: {},
      recentScores: [],
      latestNextSteps: [],
      needsAttention: false,
      showOnLeaderboard: false,
    });
  });

  it("copies the user's leaderboard opt-in", () => {
    expect(computeStudentStats({ ...stu, showOnLeaderboard: true }, [], [], now).showOnLeaderboard).toBe(true);
  });

  it("ignores draft tasks and their submissions", () => {
    const stats = computeStudentStats(stu, [task("d", -3, "coding", "draft")], [done("d", 9)], now);
    expect(stats).toMatchObject({ tasksDue: 0, tasksSubmitted: 0, missedCount: 0, avgBySkill: {} });
    expect(stats.overallAvg).toBeUndefined();
  });

  it("counts only past-due tasks as due; a future task submitted early still counts as submitted", () => {
    const tasks = [task("past", -2), task("future", 3)];
    const stats = computeStudentStats(stu, tasks, [done("future", 8)], now);
    expect(stats).toMatchObject({ tasksDue: 1, tasksSubmitted: 1, missedCount: 1 });
  });

  it("does not count error, queued or running attempts as submitted", () => {
    const tasks = [task("a", -1), task("b", -1), task("c", -1)];
    const subs = [other("a", "error"), other("b", "queued"), other("c", "running")];
    expect(computeStudentStats(stu, tasks, subs, now)).toMatchObject({ tasksSubmitted: 0, missedCount: 3 });
  });

  it("ignores other students' submissions and submissions for unknown tasks", () => {
    const stats = computeStudentStats(stu, [task("a", -1)], [done("a", 9, 1, [], "s2"), done("zzz", 9)], now);
    expect(stats).toMatchObject({ tasksSubmitted: 0, missedCount: 1 });
  });

  it("uses the best of several attempts, dated at the first attempt that reached it", () => {
    const subs = [done("a", 4, 5), done("a", 8, 4), done("a", 6, 3), done("a", 8, 2), other("a", "error")];
    const stats = computeStudentStats(stu, [task("a", -1)], subs, now);
    expect(stats.recentScores).toEqual([{ taskId: "a", type: "coding", score: 8, at: at(-4) }]);
    expect(stats.avgBySkill).toEqual({ coding: 8 });
    expect(stats.overallAvg).toBe(8);
  });

  it("averages best scores per skill and overall, to one decimal", () => {
    const tasks = [task("c1", -1), task("c2", -1), task("r1", -1, "resume"), task("i1", 2, "intro_written")];
    const subs = [done("c1", 10), done("c2", 7.5), done("r1", 6.2), done("i1", 5)];
    const stats = computeStudentStats(stu, tasks, subs, now);
    expect(stats.avgBySkill).toEqual({ coding: 8.8, resume: 6.2, intro_written: 5 }); // 8.75 → 8.8
    expect(stats.overallAvg).toBe(7.2); // 28.7 / 4 = 7.175
  });

  it("falls back to an empty roll number and OTHER branch for a user doc without them", () => {
    const bare: StatsUser = { uid: "s1", name: "New", role: "student", onboarded: true };
    expect(computeStudentStats(bare, [], [], now)).toMatchObject({ rollNo: "", branch: "OTHER" });
  });
});

describe("computeStudentStats — recent scores and next steps", () => {
  it("keeps the newest 8 scores, newest first", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, -1));
    const subs = tasks.map((t, i) => done(t.id, i, 20 - i)); // t9 is the newest
    const stats = computeStudentStats(stu, tasks, subs, now);
    expect(stats.recentScores).toHaveLength(8);
    expect(stats.recentScores.map((entry) => entry.taskId)).toEqual(["t9", "t8", "t7", "t6", "t5", "t4", "t3", "t2"]);
  });

  it("takes next steps from the newest finished resume/intro result, never from coding, max 3", () => {
    const tasks = [task("r", -5, "resume"), task("i", -5, "intro_written"), task("c", -5)];
    const subs = [
      done("r", 6, 5, ["old resume step"]),
      done("i", 7, 3, ["a", "b", "c", "d"]),
      done("c", 9, 1, ["coding results have none"]),
    ];
    expect(computeStudentStats(stu, tasks, subs, now).latestNextSteps).toEqual(["a", "b", "c"]);
  });

  it("uses the latest attempt's next steps even when an earlier attempt scored higher", () => {
    const subs = [done("r", 9, 5, ["from the best"]), done("r", 6, 1, ["from the latest"])];
    expect(computeStudentStats(stu, [task("r", -1, "resume")], subs, now).latestNextSteps).toEqual(["from the latest"]);
  });

  it("has no next steps when only coding tasks are finished", () => {
    expect(computeStudentStats(stu, [task("c", -1)], [done("c", 9, 1, ["x"])], now).latestNextSteps).toEqual([]);
  });
});

describe("computeStudentStats — needs attention", () => {
  it("flags exactly 2 missed of the last 4 past-due tasks, but not 1", () => {
    const tasks = [task("t1", -4), task("t2", -3), task("t3", -2), task("t4", -1)];
    const two = computeStudentStats(stu, tasks, [done("t1", 9), done("t2", 9)], now);
    expect(two).toMatchObject({ needsAttention: true, needsAttentionReason: "Missed 2 of the last 4 tasks" });
    const one = computeStudentStats(stu, tasks, [done("t1", 9), done("t2", 9), done("t3", 9)], now);
    expect(one.needsAttention).toBe(false);
    expect(one.needsAttentionReason).toBeUndefined();
  });

  it("only looks at the last 4 past-due tasks by due date, ignoring future ones", () => {
    const tasks = [task("old1", -10), task("old2", -9), task("t1", -4), task("t2", -3), task("t3", -2), task("t4", -1)];
    const tasksWithFuture = [...tasks, task("f1", 1), task("f2", 2)];
    const subs = ["t1", "t2", "t3", "t4"].map((id) => done(id, 9));
    const stats = computeStudentStats(stu, tasksWithFuture, subs, now);
    expect(stats).toMatchObject({ missedCount: 2, needsAttention: false });
  });

  it("flags with fewer than 4 past-due tasks when 2 are missed", () => {
    const stats = computeStudentStats(stu, [task("a", -2), task("b", -1)], [], now);
    expect(stats.needsAttentionReason).toBe("Missed 2 of the last 2 tasks");
  });

  it("flags a mean of the newest 4 scores below 5 (4.9) but not exactly 5", () => {
    const tasks = [task("a", -1), task("b", -1), task("c", -1), task("d", -1), task("e", -1)];
    const exactly5 = [done("a", 10, 9), done("b", 5, 4), done("c", 5, 3), done("d", 5, 2), done("e", 5, 1)];
    expect(computeStudentStats(stu, tasks, exactly5, now).needsAttention).toBe(false);
    const below = [done("a", 10, 9), done("b", 5, 4), done("c", 5, 3), done("d", 5, 2), done("e", 4.6, 1)];
    expect(computeStudentStats(stu, tasks, below, now)).toMatchObject({
      needsAttention: true,
      needsAttentionReason: "Average of the last 4 scores is 4.9",
    });
  });

  it("needs at least 2 scores for the score rule", () => {
    expect(computeStudentStats(stu, [task("a", 1)], [done("a", 1)], now).needsAttention).toBe(false);
    const two = computeStudentStats(stu, [task("a", 1), task("b", 1)], [done("a", 1, 2), done("b", 2)], now);
    expect(two.needsAttentionReason).toBe("Average of the last 2 scores is 1.5");
  });

  it("names both reasons when both rules apply", () => {
    const tasks = [task("a", -3), task("b", -2), task("c", 1), task("d", 2)];
    const stats = computeStudentStats(stu, tasks, [done("c", 2, 2), done("d", 3)], now);
    expect(stats.needsAttentionReason).toBe("Missed 2 of the last 2 tasks; Average of the last 2 scores is 2.5");
  });
});

describe("computeTaskStats", () => {
  const users: StatsUser[] = [
    stu,
    { uid: "s2", name: "Bo", role: "student", onboarded: true, rollNo: "0827IT2", branch: "IT" },
    { uid: "s3", name: "Cy", role: "student", onboarded: true, rollNo: "0827CS3", branch: "CSE" },
    { uid: "s4", name: "New", role: "student", onboarded: false },
    { uid: "m1", name: "Mentor", role: "mentor", onboarded: true },
    { uid: "v1", name: "Viewer", role: "viewer", onboarded: true },
  ];
  const t = task("t", -1);

  it("counts only onboarded students", () => {
    expect(countedStudents(users).map((user) => user.uid)).toEqual(["s1", "s2", "s3"]);
  });

  it("leaves out students a mentor removed, including from the not-submitted list", () => {
    const withRemoved = users.map((user) => (user.uid === "s2" ? { ...user, removed: true } : user));
    expect(countedStudents(withRemoved).map((user) => user.uid)).toEqual(["s1", "s3"]);
    expect(computeTaskStats(t, withRemoved, []).notSubmittedUids).toEqual(["s1", "s3"]);
  });

  it("lists every counted student as not submitted when nobody has finished", () => {
    const stats = computeTaskStats(t, users, [other("t", "error", "s1"), other("t", "queued", "s2")]);
    expect(stats).toEqual({ submittedCount: 0, notSubmittedUids: ["s1", "s2", "s3"], avgScoreByBranch: {} });
  });

  it("counts best scores per student, averages overall and per branch, ignores other tasks", () => {
    const subs = [
      done("t", 6, 3, [], "s1"),
      done("t", 9, 2, [], "s1"),
      done("t", 4.5, 1, [], "s2"),
      done("other", 10, 1, [], "s3"),
      done("t", 10, 1, [], "s4"), // not onboarded: ignored
    ];
    expect(computeTaskStats(t, users, subs)).toEqual({
      submittedCount: 2,
      notSubmittedUids: ["s3"],
      avgScore: 6.8, // (9 + 4.5) / 2 = 6.75
      avgScoreByBranch: { CSE: 9, IT: 4.5 },
    });
  });
});

describe("late submissions (T44): feedback only, never counted", () => {
  const late = (taskId: string, score: number, uid = "s1"): StatsSubmission => ({ ...done(taskId, score, 0, ["Late tip"], uid), late: true });

  it("a task with only late work stays missed, with no score, average or next steps from it", () => {
    const stats = computeStudentStats(stu, [task("a", -2), task("b", -3)], [late("a", 9.5), late("b", 9)], now);
    expect(stats).toMatchObject({ tasksDue: 2, tasksSubmitted: 0, missedCount: 2, avgBySkill: {}, recentScores: [] });
    expect(stats.overallAvg).toBeUndefined();
    expect(stats.latestNextSteps).toEqual([]);
    expect(stats.needsAttention).toBe(true);
    expect(stats.needsAttentionReason).toContain("Missed 2");
  });

  it("an on-time score still counts when a later late attempt scores higher", () => {
    const stats = computeStudentStats(stu, [task("a", -2)], [done("a", 6, 3), late("a", 10)], now);
    expect(stats).toMatchObject({ tasksSubmitted: 1, missedCount: 0, overallAvg: 6 });
    expect(stats.recentScores.map((entry) => entry.score)).toEqual([6]);
  });

  it("task stats list late-only students as not submitted and leave their score out of the averages", () => {
    const users: StatsUser[] = [stu, { uid: "s2", name: "Bo", role: "student", onboarded: true, rollNo: "0827IT2", branch: "IT" }];
    const stats = computeTaskStats(task("t", -1), users, [late("t", 10, "s1"), done("t", 4, 2, [], "s2")]);
    expect(stats).toMatchObject({ submittedCount: 1, notSubmittedUids: ["s1"], avgScore: 4 });
  });
});
