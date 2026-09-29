import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";
import { publishedOnly } from "./studentBoard";
import { taskDocToDto } from "./taskDoc";

const TASK_LIMIT = 200;
const SUBMISSION_LIMIT = 1000;
/** Attempts are capped at 10 per task, so 20 covers them plus a few errors. */
export const TASK_HISTORY_LIMIT = 20;

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

/** The student's own attempts on one task, newest first. Needs the composite index in firestore.indexes.json. */
export function ownTaskSubmissionsQuery(db: Firestore, uid: string, taskId: string) {
  return query(
    collection(db, "submissions"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    orderBy("createdAt", "desc"),
    limit(TASK_HISTORY_LIMIT),
  );
}

function toViews(snapshot: QuerySnapshot): SubmissionView[] {
  return snapshot.docs.flatMap((d) => submissionDocToView(d.id, d.data()) ?? []);
}

/** Published tasks plus all of the student's own submissions, for the student board. */
export async function loadStudentBoard(
  db: Firestore,
  uid: string,
): Promise<{ tasks: TaskDto[]; submissions: SubmissionView[] }> {
  const [taskSnapshot, submissionSnapshot] = await Promise.all([
    getDocs(publishedTasksQuery(db)),
    getDocs(ownSubmissionsQuery(db, uid)),
  ]);
  const tasks = taskSnapshot.docs.flatMap((d) => taskDocToDto(d.id, d.data()) ?? []);
  return { tasks: publishedOnly(tasks), submissions: toViews(submissionSnapshot) };
}

/** One published task, or undefined if missing, a draft, or not readable. */
export async function loadStudentTask(db: Firestore, taskId: string): Promise<TaskDto | undefined> {
  let task: TaskDto | undefined;
  try {
    const snapshot = await getDoc(doc(db, "tasks", taskId));
    task = snapshot.exists() ? taskDocToDto(snapshot.id, snapshot.data()) : undefined;
  } catch (error) {
    // Drafts are unreadable for students, which looks the same as "not found" to them.
    if (!(error instanceof FirebaseError && error.code === "permission-denied")) throw error;
  }
  return task?.status === "published" ? task : undefined;
}

/** Live list of the student's own attempts on one task (newest first). Returns the unsubscribe function. */
export function watchOwnTaskSubmissions(
  db: Firestore,
  uid: string,
  taskId: string,
  onData: (submissions: SubmissionView[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(ownTaskSubmissionsQuery(db, uid, taskId), (snapshot) => onData(toViews(snapshot)), onError);
}
