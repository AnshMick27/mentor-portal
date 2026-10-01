import type { ChipTone } from "@/components/ui/StatusChip";
import type { StudentTask } from "@/lib/tasks/studentBoard";

export type TaskChip = { tone: ChipTone; label: string };

/** A perfect score; nothing left to improve (coding "Accepted" is 10). */
const FULL_SCORE = 10;

/**
 * The one status chip on a student's task card and task page (docs/UX_REVIEW.md UX-07). It answers "does this still
 * need me?": retrying is how students improve, so a submitted task that is still open says "Can improve".
 */
export function taskChip(task: StudentTask, now: Date): TaskChip {
  const pastDue = Date.parse(task.dueAt) < now.getTime();
  const attemptsLeft = task.maxAttempts - task.attemptsUsed;
  if (task.attemptsUsed > 0 && task.bestScore === undefined) return { tone: "info", label: "Being checked" };
  if (task.bestScore === FULL_SCORE || (task.attemptsUsed > 0 && attemptsLeft <= 0)) return { tone: "success", label: "Done" };
  if (pastDue) return task.attemptsUsed === 0 ? { tone: "danger", label: "Missed" } : { tone: "neutral", label: "Closed" };
  if (task.attemptsUsed === 0) return { tone: "warning", label: "Not started" };
  return { tone: "info", label: `Can improve · ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left` };
}

/** "Best 6.0 / 10 · 1 of 3 attempts used", or just the attempts when there is no score yet. */
export function progressText(task: StudentTask, formatScore: (value: number) => string): string {
  const attempts = `${task.attemptsUsed} of ${task.maxAttempts} attempts used`;
  return task.bestScore === undefined ? attempts : `Best ${formatScore(task.bestScore)} · ${attempts}`;
}
