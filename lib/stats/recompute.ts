import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { taskSimilarPairs } from "@/lib/integrity/taskSimilarity";
import { computeStudentStats, computeTaskStats, countedStudents } from "@/lib/stats/compute";
import type { StatsSubmission, StatsTask, StatsUser } from "@/lib/stats/types";
import { submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
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
  const { name, role, onboarded, rollNo, branch, showOnLeaderboard, removed } = parsed.data;
  return {
    uid: doc.id,
    name,
    role,
    onboarded,
    showOnLeaderboard,
    ...(removed === true ? { removed } : {}),
    ...(rollNo ? { rollNo } : {}),
    ...(branch ? { branch } : {}),
  };
}

function toTask(doc: Snapshot): StatsTask | undefined {
  const task = taskDocToDto(doc.id, doc.data());
  return task && { id: task.id, type: task.type, status: task.status, dueAt: new Date(task.dueAt) };
}

const toView = (doc: Snapshot): SubmissionView | undefined => submissionDocToView(doc.id, doc.data());

function toSubmission(view: SubmissionView): StatsSubmission {
  const { taskId, uid, status, createdAt, result, late } = view;
  return {
    taskId,
    uid,
    status,
    createdAt,
    ...(result ? { result: { score: result.score, nextSteps: result.nextSteps } } : {}),
    ...(late ? { late } : {}),
  };
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

/**
 * `taskStats/{id}` incl. `similarPairs`. They are worked out here (nightly cron AND after each submission) because
 * this `set` replaces the whole doc: pairs added only by the cron would be wiped by the next submission.
 */
async function writeTaskStats(db: Firestore, task: StatsTask, users: StatsUser[], views: SubmissionView[], now: Date) {
  const ref = db.collection("taskStats").doc(task.id);
  if (task.status !== "published") {
    await ref.delete();
    return;
  }
  const similarPairs = taskSimilarPairs(task, new Set(countedStudents(users).map((user) => user.uid)), views);
  await ref.set({
    ...computeTaskStats(task, users, views.map(toSubmission)),
    ...(similarPairs ? { similarPairs } : {}),
    updatedAt: Timestamp.fromDate(now),
  });
}

/** Recomputes `studentStats/{uid}`. Returns false (and writes nothing) unless the user is an onboarded student. */
export async function recomputeStudent(uid: string, now = new Date()): Promise<boolean> {
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(uid).get();
  const user = snapshot.exists ? toUser(snapshot) : undefined;
  if (!user || countedStudents([user]).length === 0) return false;
  const [tasks, subs] = await Promise.all([loadTasks(db), db.collection("submissions").where("uid", "==", uid).get()]);
  await writeStudentStats(db, user, tasks, parseAll(subs.docs, toView).map(toSubmission), now);
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
  await writeTaskStats(db, task, users, parseAll(subs.docs, toView), now);
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
  const views = parseAll(subsSnapshot.docs, toView);
  const subs = views.map(toSubmission);
  const students = countedStudents(users);
  // A removed student's stats doc goes, so they leave dashboards, the leaderboard and the export.
  const removed = users.filter((user) => user.removed === true);
  await Promise.all([
    ...students.map((user) => writeStudentStats(db, user, tasks, subs, now)),
    ...tasks.map((task) => writeTaskStats(db, task, users, views, now)),
    ...removed.map((user) => db.collection("studentStats").doc(user.uid).delete()),
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
