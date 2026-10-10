import { averageScore } from "@/lib/stats/compute";
import type { StoredStudentStats, StoredTaskStats } from "@/lib/validation/stats";
import { lateCutoff, TASK_TYPE_LABEL, TASK_TYPES, type TaskDto, type TaskType } from "@/lib/validation/task";
import { BRANCHES, type Branch } from "@/lib/validation/user";

/** One student as the mentor dashboard sees them: their stats doc plus uid. */
export type MentorStudent = StoredStudentStats & { uid: string };

/** "all" or one branch (SPEC.md §8.6 "filter by branch"). */
export type BranchFilter = Branch | "all";

export type StudentRef = { uid: string; name: string; rollNo: string };

/** Where a task is in its life (T51): before the due date, taking late work (T44, T49), or closed. */
export type TaskPhase = "open" | "late" | "closed";

export function taskPhase(task: Pick<TaskDto, "dueAt" | "lateUntil">, now: Date): TaskPhase {
  if (now.getTime() <= Date.parse(task.dueAt)) return "open";
  return now.getTime() <= lateCutoff(task) ? "late" : "closed";
}

export type TaskStatusRow = {
  task: TaskDto;
  phase: TaskPhase;
  /** Students counted for this row (all onboarded students, or those of the chosen branch). */
  total: number;
  submitted: number;
  notSubmitted: StudentRef[];
  /** Average best score (whole class, or the chosen branch); undefined while nobody has submitted. */
  average?: number;
  /** False when the task has no stats doc yet (the nightly cron or the next submission writes it). */
  hasStats: boolean;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const ref = (s: MentorStudent): StudentRef => ({ uid: s.uid, name: s.name, rollNo: s.rollNo });

export function inBranch<T extends { branch: Branch }>(students: readonly T[], branch: BranchFilter): T[] {
  return branch === "all" ? [...students] : students.filter((student) => student.branch === branch);
}

/** Branches that have at least one student, in the usual order (for the filter dropdown). */
export function branchesOf(students: readonly { branch: Branch }[]): Branch[] {
  const present = new Set(students.map((student) => student.branch));
  return BRANCHES.filter((branch) => present.has(branch));
}

/**
 * Task status per task, newest due date first as given, closed tasks after the rest (T51). Non-submitters come from `taskStats.notSubmittedUids`
 * joined with the students' stats docs (names, roll numbers, branch); uids without a stats doc are skipped.
 */
export function taskStatusRows(
  tasks: readonly TaskDto[],
  statsByTask: ReadonlyMap<string, StoredTaskStats>,
  students: readonly MentorStudent[],
  branch: BranchFilter,
  now: Date,
): TaskStatusRow[] {
  const counted = inBranch(students, branch);
  const countedByUid = new Map(counted.map((student) => [student.uid, student]));
  const rows = tasks.map((task): TaskStatusRow => {
    const phase = taskPhase(task, now);
    const stats = statsByTask.get(task.id);
    if (!stats) return { task, phase, total: counted.length, submitted: 0, notSubmitted: [], hasStats: false };
    const notSubmitted = stats.notSubmittedUids
      .flatMap((uid) => {
        const student = countedByUid.get(uid);
        return student ? [ref(student)] : [];
      })
      .sort(byName);
    const average = branch === "all" ? stats.avgScore : stats.avgScoreByBranch[branch];
    return {
      task,
      phase,
      total: counted.length,
      submitted: counted.length - notSubmitted.length,
      notSubmitted,
      ...(average === undefined ? {} : { average }),
      hasStats: true,
    };
  });
  // Array sort is stable, so each group keeps the newest-due-first order.
  return rows.sort((a, b) => Number(a.phase === "closed") - Number(b.phase === "closed"));
}

export type AttentionRow = StudentRef & { branch: Branch; reason: string };

/** Students flagged by the needs-attention rule (SPEC.md §6), by name. */
export function needsAttentionList(students: readonly MentorStudent[], branch: BranchFilter): AttentionRow[] {
  return inBranch(students, branch)
    .filter((student) => student.needsAttention)
    .sort(byName)
    .map((student) => ({ ...ref(student), branch: student.branch, reason: student.needsAttentionReason ?? "Flagged" }));
}

export type ClassSkillAverage = { type: TaskType; label: string; average?: number; students: number };

/**
 * Per-skill class average = mean of the students' own averages for that skill (each student counts once),
 * with how many students have a score in it. Every skill is listed, so an empty one shows as "—".
 */
export function classSkillAverages(students: readonly MentorStudent[], branch: BranchFilter): ClassSkillAverage[] {
  const counted = inBranch(students, branch);
  return TASK_TYPES.map((type) => {
    const scores = counted.flatMap((student) => {
      const value = student.avgBySkill[type];
      return value === undefined ? [] : [value];
    });
    const average = averageScore(scores);
    return { type, label: TASK_TYPE_LABEL[type], students: scores.length, ...(average === undefined ? {} : { average }) };
  });
}
