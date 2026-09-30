import { describe, expect, it } from "vitest";
import { computeStudentStats, computeTaskStats } from "@/lib/stats/compute";
import { initialStudentStats } from "@/lib/stats/initialStudentStats";
import { storedStudentStatsSchema, storedTaskStatsSchema } from "@/lib/validation/stats";

const ts = (date: Date) => ({ toDate: () => date });
const now = new Date("2026-10-10T12:00:00Z");
const student = { uid: "s1", name: "Asha", role: "student" as const, onboarded: true, rollNo: "0827CS1", branch: "CSE" as const };
const task = { id: "t", type: "resume" as const, status: "published" as const, dueAt: new Date("2026-10-09T00:00:00Z") };
const sub = { taskId: "t", uid: "s1", status: "done" as const, createdAt: new Date("2026-10-08T00:00:00Z"), result: { score: 7.5, nextSteps: ["x"] } };

describe("storedStudentStatsSchema", () => {
  it("accepts the initial doc and a computed doc as Firestore stores them", () => {
    expect(storedStudentStatsSchema.safeParse({ ...initialStudentStats(student), updatedAt: ts(now) }).success).toBe(true);
    const computed = computeStudentStats(student, [task], [sub], now);
    const stored = {
      ...computed,
      recentScores: computed.recentScores.map((entry) => ({ ...entry, at: ts(entry.at) })),
      updatedAt: ts(now),
    };
    expect(storedStudentStatsSchema.safeParse(stored).success).toBe(true);
  });

  it("refuses unknown skills, out-of-range scores and negative counts", () => {
    const base = { ...initialStudentStats(student), updatedAt: ts(now) };
    expect(storedStudentStatsSchema.safeParse({ ...base, avgBySkill: { speaking: 5 } }).success).toBe(false);
    expect(storedStudentStatsSchema.safeParse({ ...base, overallAvg: 10.5 }).success).toBe(false);
    expect(storedStudentStatsSchema.safeParse({ ...base, missedCount: -1 }).success).toBe(false);
  });
});

describe("storedTaskStatsSchema", () => {
  it("accepts a computed doc and refuses an unknown branch", () => {
    const computed = computeTaskStats(task, [student], [sub]);
    expect(storedTaskStatsSchema.safeParse({ ...computed, updatedAt: ts(now) }).success).toBe(true);
    const bad = { ...computed, avgScoreByBranch: { MBA: 5 }, updatedAt: ts(now) };
    expect(storedTaskStatsSchema.safeParse(bad).success).toBe(false);
  });
});
