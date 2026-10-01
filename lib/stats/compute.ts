// Pure stats maths (SPEC.md §6, §8.7; definitions at the top of Loop 3 in PROGRESS.md). No Firestore here.
// Value imports are relative with `.ts` so the seed script (plain Node, T23) can load this file too.
import { bestScore } from "../submissions/scoring.ts";
import type { TaskType } from "@/lib/validation/task";
import type { Branch } from "@/lib/validation/user";
import type {
  RecentScore,
  StatsSubmission,
  StatsTask,
  StatsUser,
  StudentStatsFields,
  TaskStatsFields,
} from "./types.ts";

export const RECENT_SCORES_LIMIT = 8;
export const LATEST_NEXT_STEPS_LIMIT = 3;
/** Needs attention (SPEC.md §6): look at the last 4 past-due tasks and the newest 4 scores. */
export const ATTENTION_WINDOW = 4;
export const ATTENTION_MIN_MISSED = 2;
export const ATTENTION_MIN_SCORES = 2;
export const ATTENTION_SCORE_BELOW = 5;

const AI_TYPES: ReadonlySet<TaskType> = new Set(["resume", "intro_written"]);

/** Scores have one decimal, so summing whole tenths keeps the mean exact before the final rounding. */
function toTenths(score: number): number {
  return Math.round(score * 10);
}

/** Mean of 0–10 scores rounded to one decimal, or undefined for an empty list. */
export function averageScore(scores: readonly number[]): number | undefined {
  if (scores.length === 0) return undefined;
  const tenths = scores.reduce((sum, score) => sum + toTenths(score), 0);
  return Math.round(tenths / scores.length) / 10;
}

/** A task is past due once `now` is later than `dueAt` (submitting is allowed while `now <= dueAt`). */
export function isPastDue(task: StatsTask, now: Date): boolean {
  return now.getTime() > task.dueAt.getTime();
}

type TaskOutcome = { task: StatsTask; best: number; at: Date; nextSteps?: string[]; latestDoneAt: Date };

/** Best finished attempt for one task, or undefined if the student has no `done` submission for it. */
function outcomeFor(task: StatsTask, submissions: readonly StatsSubmission[]): TaskOutcome | undefined {
  const done = submissions.filter((submission) => submission.status === "done" && submission.result !== undefined);
  const best = bestScore(done);
  if (best === undefined) return undefined;
  const byTime = [...done].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const firstBest = byTime.find((submission) => submission.result?.score === best);
  const latest = byTime[byTime.length - 1];
  if (firstBest === undefined || latest === undefined) return undefined;
  return { task, best, at: firstBest.createdAt, nextSteps: latest.result?.nextSteps, latestDoneAt: latest.createdAt };
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function needsAttention(
  pastDue: readonly StatsTask[],
  submittedIds: ReadonlySet<string>,
  recentScores: readonly RecentScore[],
): { needsAttention: boolean; needsAttentionReason?: string } {
  const reasons: string[] = [];

  const lastPastDue = [...pastDue].sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime()).slice(0, ATTENTION_WINDOW);
  const missed = lastPastDue.filter((task) => !submittedIds.has(task.id)).length;
  if (missed >= ATTENTION_MIN_MISSED) reasons.push(`Missed ${missed} of the last ${lastPastDue.length} tasks`);

  const newest = recentScores.slice(0, ATTENTION_WINDOW).map((entry) => entry.score);
  if (newest.length >= ATTENTION_MIN_SCORES) {
    const tenths = newest.reduce((sum, score) => sum + toTenths(score), 0);
    if (tenths < ATTENTION_SCORE_BELOW * 10 * newest.length) {
      reasons.push(`Average of the last ${newest.length} scores is ${averageScore(newest)}`);
    }
  }

  return reasons.length === 0 ? { needsAttention: false } : { needsAttention: true, needsAttentionReason: reasons.join("; ") };
}

/**
 * `studentStats/{uid}` for one student. Only published tasks count; `submissions` may contain other
 * students' or other tasks' docs, which are ignored.
 */
export function computeStudentStats(
  student: StatsUser,
  tasks: readonly StatsTask[],
  submissions: readonly StatsSubmission[],
  now: Date,
): StudentStatsFields {
  const published = tasks.filter((task) => task.status === "published");
  const own = groupBy(
    submissions.filter((submission) => submission.uid === student.uid),
    (submission) => submission.taskId,
  );

  const outcomes: TaskOutcome[] = [];
  for (const task of published) {
    const outcome = outcomeFor(task, own.get(task.id) ?? []);
    if (outcome) outcomes.push(outcome);
  }
  const submittedIds = new Set(outcomes.map((outcome) => outcome.task.id));
  const pastDue = published.filter((task) => isPastDue(task, now));

  const avgBySkill: StudentStatsFields["avgBySkill"] = {};
  for (const [type, group] of groupBy(outcomes, (outcome) => outcome.task.type)) {
    const average = averageScore(group.map((outcome) => outcome.best));
    if (average !== undefined) avgBySkill[type as TaskType] = average;
  }

  const recentScores: RecentScore[] = outcomes
    .map((outcome) => ({ taskId: outcome.task.id, type: outcome.task.type, score: outcome.best, at: outcome.at }))
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.taskId.localeCompare(b.taskId))
    .slice(0, RECENT_SCORES_LIMIT);

  const latestAi = outcomes
    .filter((outcome) => AI_TYPES.has(outcome.task.type))
    .sort((a, b) => b.latestDoneAt.getTime() - a.latestDoneAt.getTime())[0];

  const overallAvg = averageScore(outcomes.map((outcome) => outcome.best));

  return {
    name: student.name,
    rollNo: student.rollNo ?? "",
    branch: student.branch ?? "OTHER",
    tasksDue: pastDue.length,
    tasksSubmitted: outcomes.length,
    missedCount: pastDue.filter((task) => !submittedIds.has(task.id)).length,
    avgBySkill,
    ...(overallAvg === undefined ? {} : { overallAvg }),
    recentScores,
    latestNextSteps: (latestAi?.nextSteps ?? []).slice(0, LATEST_NEXT_STEPS_LIMIT),
    ...needsAttention(pastDue, submittedIds, recentScores),
    showOnLeaderboard: student.showOnLeaderboard ?? false,
  };
}

/** Students who count for class stats: onboarded students only (never mentors or viewers). */
export function countedStudents(users: readonly StatsUser[]): StatsUser[] {
  return users.filter((user) => user.role === "student" && user.onboarded);
}

/**
 * `taskStats/{taskId}` for one task. `submissions` may contain other tasks' docs, which are ignored; the
 * caller decides what to do with draft tasks (T21 deletes their stats).
 */
export function computeTaskStats(
  task: StatsTask,
  users: readonly StatsUser[],
  submissions: readonly StatsSubmission[],
): TaskStatsFields {
  const byStudent = groupBy(
    submissions.filter((submission) => submission.taskId === task.id),
    (submission) => submission.uid,
  );

  const bests: number[] = [];
  const bestsByBranch = new Map<Branch, number[]>();
  const notSubmittedUids: string[] = [];
  for (const student of countedStudents(users)) {
    const outcome = outcomeFor(task, byStudent.get(student.uid) ?? []);
    if (!outcome) {
      notSubmittedUids.push(student.uid);
      continue;
    }
    bests.push(outcome.best);
    const branch = student.branch ?? "OTHER";
    bestsByBranch.set(branch, [...(bestsByBranch.get(branch) ?? []), outcome.best]);
  }

  const avgScoreByBranch: TaskStatsFields["avgScoreByBranch"] = {};
  for (const [branch, scores] of bestsByBranch) {
    const average = averageScore(scores);
    if (average !== undefined) avgScoreByBranch[branch] = average;
  }
  const avgScore = averageScore(bests);

  return {
    submittedCount: bests.length,
    notSubmittedUids: notSubmittedUids.sort(),
    ...(avgScore === undefined ? {} : { avgScore }),
    avgScoreByBranch,
  };
}
