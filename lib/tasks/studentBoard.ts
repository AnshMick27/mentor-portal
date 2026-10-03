import { attemptsUsed, bestScore, type SubmissionLike } from "@/lib/submissions/scoring";
import type { TaskDto } from "@/lib/validation/task";

/**
 * Per-task progress shown on the board and the task page (SPEC.md §8.2). `lateOnly`: every attempt that counts was
 * sent after the due date (T44), so the task is still missed.
 */
export type TaskProgress = { attemptsUsed: number; bestScore?: number; lateOnly?: true };

export type StudentTask = TaskDto & TaskProgress;

export type StudentBoard = { dueSoon: StudentTask[]; submitted: StudentTask[]; missed: StudentTask[] };

const NO_PROGRESS: TaskProgress = { attemptsUsed: 0 };

/** Belt and braces on top of the Firestore rules and query: students never see drafts. */
export function publishedOnly(tasks: TaskDto[]): TaskDto[] {
  return tasks.filter((task) => task.status === "published");
}

/** Progress for one task's submissions: attempts that count (errors excluded) and the best finished score. */
export function taskProgress(submissions: readonly SubmissionLike[], now: Date): TaskProgress {
  const best = bestScore(submissions);
  const used = attemptsUsed(submissions, now);
  const lateOnly = used > 0 && attemptsUsed(submissions.filter((submission) => submission.late !== true), now) === 0;
  return {
    attemptsUsed: used,
    ...(best === undefined ? {} : { bestScore: best }),
    ...(lateOnly ? { lateOnly: true as const } : {}),
  };
}

/** Progress per task id from all of a student's submissions. */
export function summarizeByTask(
  submissions: readonly (SubmissionLike & { taskId: string })[],
  now: Date,
): Map<string, TaskProgress> {
  const byTask = new Map<string, SubmissionLike[]>();
  for (const submission of submissions) {
    byTask.set(submission.taskId, [...(byTask.get(submission.taskId) ?? []), submission]);
  }
  return new Map([...byTask].map(([taskId, list]) => [taskId, taskProgress(list, now)]));
}

const byDue = (a: TaskDto, b: TaskDto) => Date.parse(a.dueAt) - Date.parse(b.dueAt);

/**
 * SPEC.md §8.2 groups, soonest due first in Due soon, most recent first elsewhere. Drafts are dropped.
 * - Due soon: not yet due, and either not submitted or submitted with attempts left (the student can improve, T42).
 * - Submitted: at least one attempt that counts, and closed or out of attempts.
 * - Missed: past due with no attempt that counts, or with only late attempts (T44: late work is feedback only).
 */
export function groupStudentTasks(
  tasks: TaskDto[],
  progress: ReadonlyMap<string, TaskProgress>,
  now: Date,
): StudentBoard {
  const board: StudentBoard = { dueSoon: [], submitted: [], missed: [] };
  for (const task of publishedOnly(tasks)) {
    const view: StudentTask = { ...task, ...(progress.get(task.id) ?? NO_PROGRESS) };
    const open = Date.parse(task.dueAt) >= now.getTime();
    if (open && view.attemptsUsed < task.maxAttempts) board.dueSoon.push(view);
    else if (view.attemptsUsed > 0 && !view.lateOnly) board.submitted.push(view);
    else board.missed.push(view);
  }
  board.dueSoon.sort(byDue);
  board.submitted.sort((a, b) => byDue(b, a));
  board.missed.sort((a, b) => byDue(b, a));
  return board;
}
