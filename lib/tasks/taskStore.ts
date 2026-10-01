import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import {
  taskInputSchema,
  type TaskDto,
  type TaskInput,
  type TaskPatch,
  type ValidTask,
} from "@/lib/validation/task";

const LIST_LIMIT = 200;

type TaskError = { ok: false; status: number; message: string };
export type TaskResult = { ok: true; task: TaskDto } | TaskError;

/** `updateTask`'s result; `affectsStats` is true when status, type or due date changed (stats must be recomputed). */
export type TaskUpdateResult = { ok: true; task: TaskDto; affectsStats: boolean } | TaskError;

const NOT_FOUND: TaskError = { ok: false, status: 404, message: "Task not found." };

function tasks() {
  return getAdminDb().collection("tasks");
}

/** Firestore data for a validated task. `coding` is omitted (not undefined) for non-coding tasks. */
function toStored(task: ValidTask) {
  const { coding, dueAt, ...rest } = task;
  return { ...rest, ...(coding ? { coding } : {}), dueAt: Timestamp.fromDate(new Date(dueAt)) };
}

/** All tasks, drafts included, latest due date first. Mentor/viewer only (enforced by the route). */
export async function listTasks(): Promise<TaskDto[]> {
  const snapshot = await tasks().orderBy("dueAt", "desc").limit(LIST_LIMIT).get();
  return snapshot.docs.flatMap((doc) => taskDocToDto(doc.id, doc.data()) ?? []);
}

export async function getTask(id: string): Promise<TaskResult> {
  const snapshot = await tasks().doc(id).get();
  const task = snapshot.exists ? taskDocToDto(id, snapshot.data()) : undefined;
  return task ? { ok: true, task } : NOT_FOUND;
}

export async function createTask(task: ValidTask, createdBy: string): Promise<TaskDto> {
  const ref = tasks().doc();
  const now = Timestamp.now();
  await ref.create({ ...toStored(task), createdBy, createdAt: now, updatedAt: now });
  const at = now.toDate().toISOString();
  return { ...task, dueAt: new Date(task.dueAt).toISOString(), id: ref.id, createdBy, createdAt: at, updatedAt: at };
}

/** Applies a patch to a stored task, giving a full task to re-validate with `taskInputSchema`. */
export function mergeTaskPatch(existing: TaskDto, patch: TaskPatch): TaskInput {
  const { title, description, dueAt, status, maxAttempts } = existing;
  const type = patch.type ?? existing.type;
  // A coding task changed to another type drops its coding settings unless the patch sends new ones.
  const coding =
    patch.coding === null ? undefined : (patch.coding ?? (type === "coding" ? existing.coding : undefined));
  return { title, description, dueAt, status, maxAttempts, ...patch, type, coding };
}

/** Edits (incl. publish/unpublish) a task: merge, re-validate the whole task, then write it in one transaction. */
export async function updateTask(id: string, patch: TaskPatch): Promise<TaskUpdateResult> {
  const db = getAdminDb();
  const ref = tasks().doc(id);
  return db.runTransaction(async (tx): Promise<TaskUpdateResult> => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists ? taskDocToDto(id, snapshot.data()) : undefined;
    if (!existing) return NOT_FOUND;

    const merged = taskInputSchema.safeParse(mergeTaskPatch(existing, patch));
    if (!merged.success) {
      return { ok: false, status: 400, message: merged.error.issues[0]?.message ?? "Invalid task." };
    }

    const dueAt = new Date(merged.data.dueAt).toISOString();
    const affectsStats =
      existing.status !== merged.data.status || existing.type !== merged.data.type || existing.dueAt !== dueAt;
    const now = Timestamp.now();
    const createdAt = Timestamp.fromDate(new Date(existing.createdAt));
    tx.set(ref, { ...toStored(merged.data), createdBy: existing.createdBy, createdAt, updatedAt: now });
    return {
      ok: true,
      affectsStats,
      task: {
        ...merged.data,
        dueAt,
        id,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        updatedAt: now.toDate().toISOString(),
      },
    };
  });
}
