import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { computeStudentStats, computeTaskStats, countedStudents } from "@/lib/stats/compute";
import type { StatsSubmission, StatsTask, StatsUser } from "@/lib/stats/types";
import { submissionDocToView } from "@/lib/submissions/submissionDoc";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedUserSchema } from "@/lib/validation/user";

// SPEC.md §8.7: recompute `studentStats` / `taskStats` from the source docs. Every write replaces the whole
// doc (`set`), so running any of these twice gives the same result (idempotent).

type Snapshot = { id: string; data: () => unknown };

function toUser(doc: Snapshot): StatsUser | undefined {
  const parsed = storedUserSchema.safeParse(doc.data());
  if (!parsed.success) {
    console.error(`users/${doc.id} does not match the user schema; skipped in stats`);
    return undefined;
  }
  const { name, role, onboarded, rollNo, branch } = parsed.data;
  return { uid: doc.id, name, role, onboarded, ...(rollNo ? { rollNo } : {}), ...(branch ? { branch } : {}) };
}

function toTask(doc: Snapshot): StatsTask | undefined {
  const task = taskDocToDto(doc.id, doc.data());
  return task && { id: task.id, type: task.type, status: task.status, dueAt: new Date(task.dueAt) };
}

function toSubmission(doc: Snapshot): StatsSubmission | undefined {
  const view = submissionDocToView(doc.id, doc.data());
  if (!view) return undefined;
  const { taskId, uid, status, createdAt, result } = view;
  return { taskId, uid, status, createdAt, ...(result ? { result: { score: result.score, nextSteps: result.nextSteps } } : {}) };
}

function parseAll<T>(docs: readonly Snapshot[], parse: (doc: Snapshot) => T | undefined): T[] {
  return docs.flatMap((doc) => parse(doc) ?? []);
}

// Each entry point gets the Firestore handle ONCE, before starting parallel reads: if getAdminDb() throws,
// no half-started promise is left rejected without a handler.
const loadUsers = async (db: Firestore) => parseAll((await db.collection("users").get()).docs, toUser);
const loadTasks = async (db: Firestore) => parseAll((await db.collection("tasks").get()).docs, toTask);

async function writeStudentStats(db: Firestore, user: StatsUser, tasks: StatsTask[], subs: StatsSubmission[], now: Date) {
  const fields = computeStudentStats(user, tasks, subs, now);
  await db.collection("studentStats").doc(user.uid).set({ ...fields, updatedAt: Timestamp.fromDate(now) });
}

async function writeTaskStats(db: Firestore, task: StatsTask, users: StatsUser[], subs: StatsSubmission[], now: Date) {
  const ref = db.collection("taskStats").doc(task.id);
  if (task.status !== "published") {
    await ref.delete();
    return;
  }
  await ref.set({ ...computeTaskStats(task, users, subs), updatedAt: Timestamp.fromDate(now) });
}

/** Recomputes `studentStats/{uid}`. Returns false (and writes nothing) unless the user is an onboarded student. */
export async function recomputeStudent(uid: string, now = new Date()): Promise<boolean> {
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(uid).get();
  const user = snapshot.exists ? toUser(snapshot) : undefined;
  if (!user || countedStudents([user]).length === 0) return false;
  const [tasks, subs] = await Promise.all([loadTasks(db), db.collection("submissions").where("uid", "==", uid).get()]);
  await writeStudentStats(db, user, tasks, parseAll(subs.docs, toSubmission), now);
  return true;
}

/** Recomputes `taskStats/{taskId}`; deletes it for a draft or missing task. */
export async function recomputeTask(taskId: string, now = new Date()): Promise<void> {
  const db = getAdminDb();
  const snapshot = await db.collection("tasks").doc(taskId).get();
  const task = snapshot.exists ? toTask(snapshot) : undefined;
  if (!task || task.status !== "published") {
    await db.collection("taskStats").doc(taskId).delete();
    return;
  }
  const [users, subs] = await Promise.all([
    loadUsers(db),
    db.collection("submissions").where("taskId", "==", taskId).get(),
  ]);
  await writeTaskStats(db, task, users, parseAll(subs.docs, toSubmission), now);
}

export type RecomputeAllResult = { students: number; tasks: number };

/** Every `studentStats` and `taskStats` doc from one read of users, tasks and submissions (daily cron). */
export async function recomputeAll(now = new Date()): Promise<RecomputeAllResult> {
  const db = getAdminDb();
  const [users, tasks, subsSnapshot] = await Promise.all([
    loadUsers(db),
    loadTasks(db),
    db.collection("submissions").get(),
  ]);
  const subs = parseAll(subsSnapshot.docs, toSubmission);
  const students = countedStudents(users);
  await Promise.all([
    ...students.map((user) => writeStudentStats(db, user, tasks, subs, now)),
    ...tasks.map((task) => writeTaskStats(db, task, users, subs, now)),
  ]);
  return { students: students.length, tasks: tasks.filter((task) => task.status === "published").length };
}

/** `recomputeAll` for callers whose own work already succeeded (task edits): failures are logged, never thrown. */
export async function recomputeAllAfter(reason: string): Promise<void> {
  try {
    await recomputeAll();
  } catch (error) {
    console.error(`Stats recompute after ${reason} failed (the nightly cron will retry):`, error);
  }
}
