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
  // Docs written before T26a lack it; recompute and the opt-in route keep it in step with the user doc.
  showOnLeaderboard: z.boolean().default(false),
  updatedAt: timestampLike,
});
export type StoredStudentStats = z.infer<typeof storedStudentStatsSchema>;

/** `taskStats/{taskId}` as stored (SPEC.md §6 + `avgScoreByBranch`). */
export const storedTaskStatsSchema = z.object({
  submittedCount: count,
  notSubmittedUids: z.array(z.string()),
  avgScore: scoreSchema.optional(),
  // Older docs may lack it; recompute always writes it.
  avgScoreByBranch: partialScores(BRANCHES).default({}),
  /** Code and intro tasks: students whose latest answers look alike (SPEC.md §8.9), highest first. */
  similarPairs: z
    .array(
      z.object({
        uidA: z.string(),
        uidB: z.string(),
        submissionIdA: z.string(),
        submissionIdB: z.string(),
        percent: z.number().int().min(0).max(100),
      }),
    )
    .optional(),
  updatedAt: timestampLike,
});
export type StoredTaskStats = z.infer<typeof storedTaskStatsSchema>;
