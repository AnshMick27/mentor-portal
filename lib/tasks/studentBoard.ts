import type { TaskDto } from "@/lib/validation/task";

export type StudentTask = TaskDto & { attemptsUsed: number };

export type StudentBoard = { dueSoon: StudentTask[]; submitted: StudentTask[]; missed: StudentTask[] };

/** Belt and braces on top of the Firestore rules and query: students never see drafts. */
export function publishedOnly(tasks: TaskDto[]): TaskDto[] {
  return tasks.filter((task) => task.status === "published");
}

/** Number of submissions per task id. */
export function countAttempts(submissions: { taskId: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { taskId } of submissions) counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
  return counts;
}

const byDue = (a: TaskDto, b: TaskDto) => Date.parse(a.dueAt) - Date.parse(b.dueAt);

/**
 * SPEC.md §8.2 groups: Submitted (at least one attempt), else Due soon (not yet due, soonest first) or
 * Missed (past due, most recent first). Drafts are dropped.
 */
export function groupStudentTasks(tasks: TaskDto[], attempts: ReadonlyMap<string, number>, now: Date): StudentBoard {
  const board: StudentBoard = { dueSoon: [], submitted: [], missed: [] };
  for (const task of publishedOnly(tasks)) {
    const view = { ...task, attemptsUsed: attempts.get(task.id) ?? 0 };
    if (view.attemptsUsed > 0) board.submitted.push(view);
    else if (Date.parse(task.dueAt) >= now.getTime()) board.dueSoon.push(view);
    else board.missed.push(view);
  }
  board.dueSoon.sort(byDue);
  board.submitted.sort((a, b) => byDue(b, a));
  board.missed.sort((a, b) => byDue(b, a));
  return board;
}
