import { findSimilarPairs, type SimilarPair } from "@/lib/integrity/similarity";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskType } from "@/lib/validation/task";

type Attempt = Pick<SubmissionView, "id" | "taskId" | "uid" | "status" | "createdAt" | "content" | "language">;

/**
 * `taskStats.similarPairs` for one task (SPEC.md §8.9): each counted student's latest finished attempt, late ones
 * included (copying is copying). Undefined for a resume task, which is meant to be pasted and is never compared.
 */
export function taskSimilarPairs(
  task: { id: string; type: TaskType },
  studentUids: ReadonlySet<string>,
  attempts: readonly Attempt[],
): SimilarPair[] | undefined {
  if (task.type === "resume") return undefined;
  const latest = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (attempt.taskId !== task.id || attempt.status !== "done" || !studentUids.has(attempt.uid)) continue;
    const current = latest.get(attempt.uid);
    if (!current || attempt.createdAt.getTime() > current.createdAt.getTime()) latest.set(attempt.uid, attempt);
  }
  const entries = [...latest.values()]
    .sort((a, b) => a.uid.localeCompare(b.uid))
    .map(({ id, uid, content, language }) => ({ submissionId: id, uid, content, ...(language ? { language } : {}) }));
  return findSimilarPairs(task.type, entries);
}
