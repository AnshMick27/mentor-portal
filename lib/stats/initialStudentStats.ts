import type { Branch } from "@/lib/validation/user";

/** `studentStats/{uid}` fields (SPEC.md §6) except `updatedAt`, which the writer sets. */
export type StudentStatsFields = {
  name: string;
  rollNo: string;
  branch: Branch;
  tasksDue: number;
  tasksSubmitted: number;
  missedCount: number;
  avgBySkill: Partial<Record<"coding" | "resume" | "intro_written", number>>;
  recentScores: { taskId: string; type: string; score: number; at: unknown }[];
  latestNextSteps: string[];
  needsAttention: boolean;
  needsAttentionReason?: string;
};

/** Empty stats for a freshly onboarded student; the recompute job (Loop 3) fills in real numbers. */
export function initialStudentStats(student: { name: string; rollNo: string; branch: Branch }): StudentStatsFields {
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
  };
}
