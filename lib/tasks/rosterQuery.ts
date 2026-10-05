import { collection, doc, getDoc, getDocs, limit, query, where, type Firestore } from "firebase/firestore";
import type { SimilarPair } from "@/lib/integrity/similarity";
import { loadStudentList } from "@/lib/students/listQuery";
import { submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
import { rosterStudents, type RosterStudent } from "@/lib/tasks/submissionRoster";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedTaskStatsSchema } from "@/lib/validation/stats";
import type { TaskDto } from "@/lib/validation/task";

/** ~50 students × at most 10 attempts each; far above that, so nobody is silently cut off. */
const TASK_SUBMISSIONS_LIMIT = 5000;

/** Every attempt on one task (mentor/viewer only, by the rules). Single equality: no composite index needed. */
export function taskSubmissionsQuery(db: Firestore, taskId: string) {
  return query(collection(db, "submissions"), where("taskId", "==", taskId), limit(TASK_SUBMISSIONS_LIMIT));
}

export type TaskRosterData = {
  task: TaskDto;
  students: RosterStudent[];
  submissions: SubmissionView[];
  /** From `taskStats` (SPEC.md §8.9); absent before the first recompute and for a resume task. */
  similarPairs?: SimilarPair[];
};

/** What `/mentor/tasks/[id]/submissions` shows; undefined when there is no such task. */
export async function loadTaskRoster(db: Firestore, taskId: string): Promise<TaskRosterData | undefined> {
  const [taskSnapshot, studentRows, submissionSnapshot, statsSnapshot] = await Promise.all([
    getDoc(doc(db, "tasks", taskId)),
    loadStudentList(db),
    getDocs(taskSubmissionsQuery(db, taskId)),
    getDoc(doc(db, "taskStats", taskId)),
  ]);
  const task = taskSnapshot.exists() ? taskDocToDto(taskSnapshot.id, taskSnapshot.data()) : undefined;
  if (!task) return undefined;
  const stats = statsSnapshot.exists() ? storedTaskStatsSchema.safeParse(statsSnapshot.data()) : undefined;
  if (stats && !stats.success) console.error(`taskStats/${taskId} does not match the stats schema`);
  return {
    task,
    students: rosterStudents(studentRows),
    submissions: submissionSnapshot.docs.flatMap((d) => submissionDocToView(d.id, d.data()) ?? []),
    ...(stats?.success && stats.data.similarPairs ? { similarPairs: stats.data.similarPairs } : {}),
  };
}
