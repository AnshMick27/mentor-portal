import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Firestore } from "firebase/firestore";
import type { MentorStudent } from "@/lib/dashboard/mentor";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedStudentStatsSchema, storedTaskStatsSchema, type StoredTaskStats } from "@/lib/validation/stats";
import type { TaskDto } from "@/lib/validation/task";

export const RECENT_TASKS = 10;
/** One stats doc per onboarded student; far above a batch of ~50, so nobody is silently cut off. */
const STUDENT_STATS_LIMIT = 500;

/** The 10 published tasks with the latest due dates. Needs the tasks status + dueAt index. */
export function recentPublishedTasksQuery(db: Firestore) {
  return query(
    collection(db, "tasks"),
    where("status", "==", "published"),
    orderBy("dueAt", "desc"),
    limit(RECENT_TASKS),
  );
}

/** Every student's precomputed stats (mentor/viewer only, enforced by the rules). */
export function allStudentStatsQuery(db: Firestore) {
  return query(collection(db, "studentStats"), limit(STUDENT_STATS_LIMIT));
}

export type MentorDashboardData = {
  tasks: TaskDto[];
  taskStats: Map<string, StoredTaskStats>;
  students: MentorStudent[];
};

async function loadTaskStats(db: Firestore, taskId: string): Promise<[string, StoredTaskStats] | undefined> {
  const snapshot = await getDoc(doc(db, "taskStats", taskId));
  if (!snapshot.exists()) return undefined;
  const parsed = storedTaskStatsSchema.safeParse(snapshot.data());
  if (!parsed.success) console.error(`taskStats/${taskId} does not match the stats schema`);
  return parsed.success ? [taskId, parsed.data] : undefined;
}

/**
 * The mentor dashboard reads only precomputed docs (SPEC.md §8.6): the 10 latest published tasks, their
 * taskStats, and every studentStats doc. About 70 reads for a batch of 50; no raw submissions.
 */
export async function loadMentorDashboard(db: Firestore): Promise<MentorDashboardData> {
  const [taskSnapshot, statsSnapshot] = await Promise.all([
    getDocs(recentPublishedTasksQuery(db)),
    getDocs(allStudentStatsQuery(db)),
  ]);
  const tasks = taskSnapshot.docs.flatMap((d) => taskDocToDto(d.id, d.data()) ?? []);
  const taskStats = await Promise.all(tasks.map((task) => loadTaskStats(db, task.id)));
  const students = statsSnapshot.docs.flatMap((d) => {
    const parsed = storedStudentStatsSchema.safeParse(d.data());
    if (!parsed.success) console.error(`studentStats/${d.id} does not match the stats schema`);
    return parsed.success ? [{ ...parsed.data, uid: d.id }] : [];
  });
  return { tasks, taskStats: new Map(taskStats.flatMap((entry) => (entry ? [entry] : []))), students };
}
