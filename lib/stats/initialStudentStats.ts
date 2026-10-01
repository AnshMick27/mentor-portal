import type { StudentStatsFields } from "@/lib/stats/types";
import type { Branch } from "@/lib/validation/user";

/** Empty stats for a freshly onboarded student; `lib/stats/compute.ts` fills in real numbers later. */
export function initialStudentStats(student: {
  name: string;
  rollNo: string;
  branch: Branch;
  showOnLeaderboard?: boolean;
}): StudentStatsFields {
  return {
    name: student.name,
    rollNo: student.rollNo,
    branch: student.branch,
    tasksDue: 0,
    tasksSubmitted: 0,
    missedCount: 0,
    avgBySkill: {},
    recentScores: [],
    latestNextSteps: [],
    needsAttention: false,
    showOnLeaderboard: student.showOnLeaderboard ?? false,
  };
}
