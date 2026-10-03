import type { SubmissionStatus } from "@/lib/validation/submission";
import type { TaskStatus, TaskType } from "@/lib/validation/task";
import type { Branch, Role } from "@/lib/validation/user";

/** One point of a student's progress: the best score for one task, `at` = when that best attempt was made. */
export type RecentScore = { taskId: string; type: TaskType; score: number; at: Date };

/** `studentStats/{uid}` fields (SPEC.md §6 + `overallAvg`) except `updatedAt`, which the writer sets. */
export type StudentStatsFields = {
  name: string;
  rollNo: string;
  branch: Branch;
  tasksDue: number;
  tasksSubmitted: number;
  missedCount: number;
  avgBySkill: Partial<Record<TaskType, number>>;
  /** Mean of the best scores of every submitted task; absent until the first finished submission. */
  overallAvg?: number;
  recentScores: RecentScore[];
  latestNextSteps: string[];
  needsAttention: boolean;
  needsAttentionReason?: string;
  /** Copy of `users/{uid}.showOnLeaderboard`, so the leaderboard is one indexed query on studentStats. */
  showOnLeaderboard: boolean;
};

/** `taskStats/{taskId}` fields (SPEC.md §6 + `avgScoreByBranch`) except `updatedAt`. */
export type TaskStatsFields = {
  submittedCount: number;
  notSubmittedUids: string[];
  /** Mean of the students' best scores; absent while nobody has submitted. */
  avgScore?: number;
  avgScoreByBranch: Partial<Record<Branch, number>>;
};

/** The task fields the stats need (dates already converted from Timestamps). */
export type StatsTask = { id: string; type: TaskType; status: TaskStatus; dueAt: Date };

/** The user fields the stats need. */
export type StatsUser = {
  uid: string;
  name: string;
  role: Role;
  onboarded: boolean;
  rollNo?: string;
  branch?: Branch;
  showOnLeaderboard?: boolean;
  /** Removed by a mentor: left out of every stat (T34a). */
  removed?: boolean;
};

/** The submission fields the stats need. */
export type StatsSubmission = {
  taskId: string;
  uid: string;
  status: SubmissionStatus;
  createdAt: Date;
  result?: { score: number; nextSteps: string[] };
  /** Late attempts (T44) never count. */
  late?: boolean;
};
