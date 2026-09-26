import { FirebaseError } from "firebase/app";
import { collection, doc, getDoc, getDocs, limit, query, where, type Firestore } from "firebase/firestore";
import { z } from "zod";
import type { TaskDto } from "@/lib/validation/task";
import { countAttempts, publishedOnly } from "./studentBoard";
import { taskDocToDto } from "./taskDoc";

const TASK_LIMIT = 200;
const SUBMISSION_LIMIT = 1000;

/** Only the fields the board needs from `submissions/{id}`. */
const submissionRefSchema = z.object({ taskId: z.string() });

/**
 * Student reads go straight to Firestore (SPEC.md §5). Each query MUST carry the filter the rules check,
 * or Firestore rejects it: tasks by `status == "published"`, submissions by the student's own uid.
 */
export function publishedTasksQuery(db: Firestore) {
  return query(collection(db, "tasks"), where("status", "==", "published"), limit(TASK_LIMIT));
}

export function ownSubmissionsQuery(db: Firestore, uid: string) {
  return query(collection(db, "submissions"), where("uid", "==", uid), limit(SUBMISSION_LIMIT));
}

async function loadAttempts(db: Firestore, uid: string): Promise<Map<string, number>> {
  const snapshot = await getDocs(ownSubmissionsQuery(db, uid));
  return countAttempts(snapshot.docs.flatMap((d) => submissionRefSchema.safeParse(d.data()).data ?? []));
}

/** Published tasks plus attempts used per task, for the student board. */
export async function loadStudentBoard(
  db: Firestore,
  uid: string,
): Promise<{ tasks: TaskDto[]; attempts: Map<string, number> }> {
  const [taskSnapshot, attempts] = await Promise.all([getDocs(publishedTasksQuery(db)), loadAttempts(db, uid)]);
  const tasks = taskSnapshot.docs.flatMap((d) => taskDocToDto(d.id, d.data()) ?? []);
  return { tasks: publishedOnly(tasks), attempts };
}

/** One published task (undefined if missing, a draft, or not readable) plus the student's attempts on it. */
export async function loadStudentTask(
  db: Firestore,
  uid: string,
  taskId: string,
): Promise<{ task: TaskDto | undefined; attemptsUsed: number }> {
  let task: TaskDto | undefined;
  try {
    const snapshot = await getDoc(doc(db, "tasks", taskId));
    task = snapshot.exists() ? taskDocToDto(snapshot.id, snapshot.data()) : undefined;
  } catch (error) {
    // Drafts are unreadable for students, which looks the same as "not found" to them.
    if (!(error instanceof FirebaseError && error.code === "permission-denied")) throw error;
  }
  if (!task || task.status !== "published") return { task: undefined, attemptsUsed: 0 };
  const attempts = await loadAttempts(db, uid);
  return { task, attemptsUsed: attempts.get(taskId) ?? 0 };
}
