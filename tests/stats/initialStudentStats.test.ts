import { describe, expect, it } from "vitest";
import { initialStudentStats } from "@/lib/stats/initialStudentStats";

describe("initialStudentStats", () => {
  it("copies identity fields and starts every counter empty", () => {
    expect(initialStudentStats({ name: "Stu", rollNo: "ABC123", branch: "IT" })).toEqual({
      name: "Stu",
      rollNo: "ABC123",
      branch: "IT",
      tasksDue: 0,
      tasksSubmitted: 0,
      missedCount: 0,
      avgBySkill: {},
      recentScores: [],
      latestNextSteps: [],
      needsAttention: false,
    });
  });
});
