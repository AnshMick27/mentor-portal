import { formatIst } from "@/lib/dates/ist";
import { lateCutoff, type TaskDto } from "@/lib/validation/task";

/**
 * `late`: past the due date, so the attempt gets feedback but is never scored (SPEC.md §8.2, T44). `lateUntil`: ISO
 * time late work closes (T49).
 */
export type SubmitAvailability =
  | { open: true; attemptsLeft: number; late: boolean; lateUntil: string }
  | { open: false; reason: string };

/** Shown once late work has closed (T49); the server refuses with the same words. */
export function closedMessage(task: Pick<TaskDto, "dueAt" | "lateUntil">): string {
  return `This task closed on ${formatIst(new Date(lateCutoff(task)).toISOString())}. It no longer takes submissions.`;
}

/**
 * Whether the student may submit now. Mirrors the server: the attempt limit closes the form; after the due date it
 * stays open as late, feedback-only work until `lateCutoff`, then closes. The server still enforces all three.
 */
export function submitAvailability(task: TaskDto, attemptsUsed: number, now: Date): SubmitAvailability {
  const attemptsLeft = task.maxAttempts - attemptsUsed;
  if (attemptsLeft <= 0) return { open: false, reason: `You have used all ${task.maxAttempts} attempts for this task.` };
  const cutoff = lateCutoff(task);
  if (now.getTime() > cutoff) return { open: false, reason: closedMessage(task) };
  return { open: true, attemptsLeft, late: now.getTime() > Date.parse(task.dueAt), lateUntil: new Date(cutoff).toISOString() };
}
