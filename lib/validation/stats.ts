import { z } from "zod";
import { scoreSchema } from "@/lib/validation/submission";
import { TASK_TYPES } from "@/lib/validation/task";
import { timestampLike } from "@/lib/validation/timestamp";
import { BRANCHES, branchSchema } from "@/lib/validation/user";

const count = z.number().int().min(0);

/** Record keyed by a fixed set of names, every key optional (e.g. averages per skill or per branch). */
function partialScores<const K extends readonly [string, ...string[]]>(keys: K) {
  return z.partialRecord(z.enum(keys), scoreSchema);
}

/** `studentStats/{uid}` as stored (SPEC.md §6 + `overallAvg`). Read by dashboards; not strict. */
export const storedStudentStatsSchema = z.object({
  name: z.string(),
  rollNo: z.string(),
  branch: branchSchema,
  tasksDue: count,
  tasksSubmitted: count,
  missedCount: count,
  avgBySkill: partialScores(TASK_TYPES),
  overallAvg: scoreSchema.optional(),
  recentScores: z.array(
    z.object({ taskId: z.string(), type: z.enum(TASK_TYPES), score: scoreSchema, at: timestampLike }),
  ),
  latestNextSteps: z.array(z.string()),
  needsAttention: z.boolean(),
  needsAttentionReason: z.string().optional(),
  updatedAt: timestampLike,
});
export type StoredStudentStats = z.infer<typeof storedStudentStatsSchema>;

/** `taskStats/{taskId}` as stored (SPEC.md §6 + `avgScoreByBranch`). */
export const storedTaskStatsSchema = z.object({
  submittedCount: count,
  notSubmittedUids: z.array(z.string()),
  avgScore: scoreSchema.optional(),
  avgScoreByBranch: partialScores(BRANCHES),
  updatedAt: timestampLike,
});
export type StoredTaskStats = z.infer<typeof storedTaskStatsSchema>;
