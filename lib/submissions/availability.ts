import type { TaskDto } from "@/lib/validation/task";

/** `late`: past the due date, so the attempt gets feedback but is never scored (SPEC.md §8.2, T44). */
export type SubmitAvailability = { open: true; attemptsLeft: number; late: boolean } | { open: false; reason: string };

/**
 * Whether the student may submit now. Mirrors the server: the attempt limit closes the form, and after the due date
 * it stays open as late, feedback-only work. The server still enforces both.
 */
export function submitAvailability(task: TaskDto, attemptsUsed: number, now: Date): SubmitAvailability {
  const attemptsLeft = task.maxAttempts - attemptsUsed;
  if (attemptsLeft <= 0) return { open: false, reason: `You have used all ${task.maxAttempts} attempts for this task.` };
  return { open: true, attemptsLeft, late: now.getTime() > Date.parse(task.dueAt) };
}
