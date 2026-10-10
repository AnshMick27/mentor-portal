import { z } from "zod";
import { codingSchema, TASK_STATUSES, TASK_TYPES, type TaskDto } from "@/lib/validation/task";
import { timestampLike } from "@/lib/validation/timestamp";

/** `tasks/{taskId}` as stored (SPEC.md §6). Not strict: unknown extra fields are ignored. */
const storedTaskSchema = z.object({
  title: z.string(),
  type: z.enum(TASK_TYPES),
  description: z.string(),
  dueAt: timestampLike,
  lateUntil: timestampLike.optional(),
  status: z.enum(TASK_STATUSES),
  maxAttempts: z.number(),
  coding: codingSchema.optional(),
  createdBy: z.string(),
  createdAt: timestampLike,
  updatedAt: timestampLike,
});

/** Firestore task data → `TaskDto` (ISO dates). Malformed docs give undefined and are logged, never thrown. */
export function taskDocToDto(id: string, data: unknown): TaskDto | undefined {
  const parsed = storedTaskSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`tasks/${id} does not match the task schema`);
    return undefined;
  }
  const { dueAt, lateUntil, createdAt, updatedAt, coding, ...rest } = parsed.data;
  return {
    id,
    ...rest,
    ...(coding ? { coding } : {}),
    dueAt: dueAt.toDate().toISOString(),
    ...(lateUntil ? { lateUntil: lateUntil.toDate().toISOString() } : {}),
    createdAt: createdAt.toDate().toISOString(),
    updatedAt: updatedAt.toDate().toISOString(),
  };
}
