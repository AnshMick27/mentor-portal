import { newestFirst, type SubmissionView } from "@/lib/submissions/submissionDoc";
import { taskProgress } from "@/lib/tasks/studentBoard";
import type { TaskDto } from "@/lib/validation/task";

/** Firebase uids (and the seed's ids) in URLs: letters, digits, `_` and `-`, at most 128 characters. */
export function isValidUid(uid: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid);
}

export type ProfileTaskState = "submitted" | "missed" | "open";

export type ProfileTaskRow = {
  task: TaskDto;
  /** This student's attempts on the task among the pages loaded so far, newest first. */
  attempts: SubmissionView[];
  attemptsUsed: number;
  bestScore?: number;
  state: ProfileTaskState;
};

export const PROFILE_STATE_LABEL: Record<ProfileTaskState, string> = {
  submitted: "Submitted",
  missed: "Missed",
  open: "Not due yet",
};

/**
 * One row per published task (latest due date first) with the student's attempts, attempts used (errors not
 * counted), best score and state: submitted = a finished attempt; missed = past due without one.
 */
export function profileTaskRows(
  tasks: readonly TaskDto[],
  submissions: readonly SubmissionView[],
  now: Date,
): ProfileTaskRow[] {
  const byTask = new Map<string, SubmissionView[]>();
  for (const submission of submissions) {
    byTask.set(submission.taskId, [...(byTask.get(submission.taskId) ?? []), submission]);
  }
  return tasks
    .filter((task) => task.status === "published")
    .sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt))
    .map((task) => {
      const attempts = newestFirst(byTask.get(task.id) ?? []);
      const progress = taskProgress(attempts, now);
      const state: ProfileTaskState =
        progress.bestScore !== undefined ? "submitted" : Date.parse(task.dueAt) < now.getTime() ? "missed" : "open";
      return { task, attempts, ...progress, state };
    });
}

/** Attempts on tasks that are not (or no longer) published, so the mentor knows they exist. */
export function attemptsOnOtherTasks(tasks: readonly TaskDto[], submissions: readonly SubmissionView[]): number {
  const published = new Set(tasks.filter((task) => task.status === "published").map((task) => task.id));
  return submissions.filter((submission) => !published.has(submission.taskId)).length;
}
