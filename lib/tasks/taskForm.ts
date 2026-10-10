import { fromIstInputValue, toIstInputValue } from "@/lib/dates/ist";
import type { Language, TaskDto, TaskInput, TaskPatch, TaskStatus, TaskType, ValidTask } from "@/lib/validation/task";

/** Everything the task form edits, as the inputs hold it (strings), before validation. */
export type TaskFormState = {
  title: string;
  type: TaskType;
  description: string;
  /** `datetime-local` value, always meant as IST. */
  dueAtLocal: string;
  /** `datetime-local` value (IST) late work closes; blank = `LATE_GRACE_DAYS` after the due date (T49). */
  lateUntilLocal: string;
  /** Blank = the per-type default. */
  maxAttempts: string;
  status: TaskStatus;
  problemSlug: string;
  languages: Language[];
  sampleTests: { input: string; output: string }[];
  timeLimitMs: string;
  /** Scenario only: hidden notes for the AI grader (T50). */
  gradingNotes: string;
};

export function emptyTaskForm(): TaskFormState {
  return {
    title: "",
    type: "coding",
    description: "",
    dueAtLocal: "",
    lateUntilLocal: "",
    maxAttempts: "",
    status: "draft",
    problemSlug: "",
    languages: ["cpp", "java", "python"],
    sampleTests: [{ input: "", output: "" }],
    timeLimitMs: "2000",
    gradingNotes: "",
  };
}

export function taskToForm(task: TaskDto): TaskFormState {
  const empty = emptyTaskForm();
  return {
    title: task.title,
    type: task.type,
    description: task.description,
    dueAtLocal: toIstInputValue(task.dueAt),
    lateUntilLocal: task.lateUntil ? toIstInputValue(task.lateUntil) : "",
    maxAttempts: String(task.maxAttempts),
    status: task.status,
    problemSlug: task.coding?.problemSlug ?? empty.problemSlug,
    languages: task.coding?.languages ?? empty.languages,
    sampleTests: task.coding?.sampleTests ?? empty.sampleTests,
    timeLimitMs: task.coding ? String(task.coding.timeLimitMs) : empty.timeLimitMs,
    gradingNotes: task.gradingNotes ?? "",
  };
}

/** Blank → undefined; anything else → a number (NaN for junk, which the schema then rejects). */
function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

/** Form → body for `taskInputSchema` / POST. Validate the result with the schema before sending. */
export function formToTaskInput(form: TaskFormState): TaskInput {
  return {
    title: form.title,
    type: form.type,
    description: form.description,
    dueAt: fromIstInputValue(form.dueAtLocal) ?? "",
    // Blank → default window; a junk value is sent as "" so the schema reports it.
    lateUntil: form.lateUntilLocal.trim() === "" ? undefined : (fromIstInputValue(form.lateUntilLocal) ?? ""),
    status: form.status,
    maxAttempts: optionalNumber(form.maxAttempts),
    coding:
      form.type === "coding"
        ? {
            problemSlug: form.problemSlug,
            languages: form.languages,
            sampleTests: form.sampleTests,
            timeLimitMs: optionalNumber(form.timeLimitMs) ?? Number.NaN,
          }
        : undefined,
    // Notes typed for a scenario stay in the form if the type changes, but only a scenario sends them.
    gradingNotes: form.type === "scenario" ? form.gradingNotes : undefined,
  };
}

/**
 * PATCH body from a validated task: `coding: null` clears coding settings for non-coding tasks, `lateUntil: null`
 * goes back to the default late window, `gradingNotes: null` removes blank or non-scenario notes.
 */
export function taskToPatch(task: ValidTask): TaskPatch {
  return { ...task, coding: task.coding ?? null, lateUntil: task.lateUntil ?? null, gradingNotes: task.gradingNotes ?? null };
}
