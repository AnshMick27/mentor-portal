import type { TaskDto } from "@/lib/validation/task";

export type SubmitAvailability = { open: true; attemptsLeft: number } | { open: false; reason: string };

/**
 * Whether the student may submit now. Mirrors the server's checks (past due, attempts used up) so the form
 * is hidden instead of failing; the server still enforces both.
 */
export function submitAvailability(task: TaskDto, attemptsUsed: number, now: Date): SubmitAvailability {
  if (now.getTime() > Date.parse(task.dueAt)) {
    return { open: false, reason: "The due date has passed, so this task no longer takes submissions." };
  }
  const attemptsLeft = task.maxAttempts - attemptsUsed;
  if (attemptsLeft <= 0) return { open: false, reason: `You have used all ${task.maxAttempts} attempts for this task.` };
  return { open: true, attemptsLeft };
}
