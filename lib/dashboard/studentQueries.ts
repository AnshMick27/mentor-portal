import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Firestore,
  type QuerySnapshot,
} from "firebase/firestore";
import { tasksThisWeek } from "@/lib/dashboard/student";
import { submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
import { summarizeByTask, type StudentTask } from "@/lib/tasks/studentBoard";
import { publishedTasksQuery } from "@/lib/tasks/studentQueries";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedStudentStatsSchema, type StoredStudentStats } from "@/lib/validation/stats";
import type { TaskDto } from "@/lib/validation/task";

export const LATEST_RESULTS_LIMIT = 3;
/** Firestore `in` filters take a limited list; 10 is safe on every SDK version. */
const IN_CHUNK = 10;

/** The student's newest finished results. Needs the uid + status + createdAt index in firestore.indexes.json. */
export function latestResultsQuery(db: Firestore, uid: string) {
  return query(
    collection(db, "submissions"),
    where("uid", "==", uid),
    where("status", "==", "done"),
    orderBy("createdAt", "desc"),
    limit(LATEST_RESULTS_LIMIT),
  );
}

/** The student's own attempts on a few tasks (at most 10 ids). Carries the uid filter the rules require. */
export function ownSubmissionsForTasksQuery(db: Firestore, uid: string, taskIds: readonly string[]) {
  return query(collection(db, "submissions"), where("uid", "==", uid), where("taskId", "in", [...taskIds]));
}

const toViews = (snapshot: QuerySnapshot) => snapshot.docs.flatMap((d) => submissionDocToView(d.id, d.data()) ?? []);

async function loadOwnSubmissionsForTasks(db: Firestore, uid: string, taskIds: string[]): Promise<SubmissionView[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < taskIds.length; i += IN_CHUNK) chunks.push(taskIds.slice(i, i + IN_CHUNK));
  const snapshots = await Promise.all(chunks.map((ids) => getDocs(ownSubmissionsForTasksQuery(db, uid, ids))));
  return snapshots.flatMap(toViews);
}

async function loadOwnStats(db: Firestore, uid: string): Promise<StoredStudentStats | undefined> {
  const snapshot = await getDoc(doc(db, "studentStats", uid));
  if (!snapshot.exists()) return undefined;
  const parsed = storedStudentStatsSchema.safeParse(snapshot.data());
  if (!parsed.success) console.error(`studentStats/${uid} does not match the stats schema`);
  return parsed.success ? parsed.data : undefined;
}

export type StudentDashboardData = {
  /** All published tasks (titles for the feedback list). */
  tasks: TaskDto[];
  week: StudentTask[];
  latest: SubmissionView[];
  stats?: StoredStudentStats;
};

/**
 * Everything the student home screen shows, in a handful of reads: published tasks, the student's attempts on
 * this week's tasks only, their 3 newest results, and their precomputed stats doc (SPEC.md §8.5, §11).
 */
export async function loadStudentDashboard(db: Firestore, uid: string, now: Date): Promise<StudentDashboardData> {
  const [taskSnapshot, latestSnapshot, stats] = await Promise.all([
    getDocs(publishedTasksQuery(db)),
    getDocs(latestResultsQuery(db, uid)),
    loadOwnStats(db, uid),
  ]);
  const tasks = taskSnapshot.docs.flatMap((d) => taskDocToDto(d.id, d.data()) ?? []);
  const weekIds = tasksThisWeek(tasks, new Map(), now).map((task) => task.id);
  const weekSubmissions = await loadOwnSubmissionsForTasks(db, uid, weekIds);
  return {
    tasks,
    week: tasksThisWeek(tasks, summarizeByTask(weekSubmissions, now), now),
    latest: toViews(latestSnapshot),
    ...(stats ? { stats } : {}),
  };
}
