import { z } from "zod";

export const TASK_TYPES = ["coding", "resume", "intro_written"] as const;
export const TASK_STATUSES = ["draft", "published"] as const;
export const LANGUAGES = ["cpp", "java", "python"] as const;

export type TaskType = (typeof TASK_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Language = (typeof LANGUAGES)[number];

/** SPEC.md §6 defaults when a mentor does not set maxAttempts. */
export const DEFAULT_MAX_ATTEMPTS: Record<TaskType, number> = { coding: 5, resume: 3, intro_written: 3 };

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  coding: "Coding",
  resume: "Resume",
  intro_written: "Written intro",
};

export const LANGUAGE_LABEL: Record<Language, string> = { cpp: "C++", java: "Java", python: "Python" };

const sampleTestSchema = z.strictObject({
  input: z.string().max(2000, "Sample input must be at most 2,000 characters."),
  output: z.string().max(2000, "Sample output must be at most 2,000 characters."),
});

/**
 * Coding settings. Strict, so a `hiddenTests` field (or anything else) is rejected: hidden tests live only
 * in the judge repo (SPEC.md §7.5).
 */
export const codingSchema = z.strictObject({
  problemSlug: z
    .string()
    .trim()
    .max(60, "Problem slug must be at most 60 characters.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Problem slug must be lowercase-kebab-case, e.g. two-sum."),
  languages: z
    .array(z.enum(LANGUAGES))
    .min(1, "Choose at least one language.")
    .refine((langs) => new Set(langs).size === langs.length, "Each language may appear only once."),
  sampleTests: z
    .array(sampleTestSchema)
    .min(1, "Add at least one sample test.")
    .max(5, "Add at most five sample tests."),
  timeLimitMs: z
    .number()
    .int("Time limit must be a whole number of milliseconds.")
    .min(500, "Time limit must be between 500 and 5000 ms.")
    .max(5000, "Time limit must be between 500 and 5000 ms."),
});
export type CodingSettings = z.infer<typeof codingSchema>;

const taskFields = {
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be at most 120 characters."),
  type: z.enum(TASK_TYPES, "Choose a task type."),
  description: z
    .string()
    .trim()
    .min(1, "Add a description.")
    .max(20000, "Description must be at most 20,000 characters."),
  /** ISO 8601 with a time zone, e.g. `2026-10-05T23:59:00+05:30`. */
  dueAt: z.iso.datetime({ offset: true, message: "Due date must be a valid date and time." }),
  status: z.enum(TASK_STATUSES),
  maxAttempts: z
    .number()
    .int("Max attempts must be a whole number.")
    .min(1, "Max attempts must be between 1 and 10.")
    .max(10, "Max attempts must be between 1 and 10."),
  coding: codingSchema,
};

type TaskShapeCheck = { type: TaskType; coding?: unknown };

/** Coding settings are required for coding tasks and not allowed for the others. */
function checkCodingMatchesType(task: TaskShapeCheck, ctx: z.RefinementCtx): void {
  if (task.type === "coding" && task.coding === undefined) {
    ctx.addIssue({ code: "custom", path: ["coding"], message: "Coding tasks need coding settings." });
  }
  if (task.type !== "coding" && task.coding !== undefined) {
    ctx.addIssue({ code: "custom", path: ["coding"], message: "Only coding tasks have coding settings." });
  }
}

/** A complete task as the mentor submits it (create, and the merged result of every edit). */
export const taskInputSchema = z
  .strictObject({
    ...taskFields,
    status: taskFields.status.default("draft"),
    maxAttempts: taskFields.maxAttempts.optional(),
    coding: taskFields.coding.optional(),
  })
  .superRefine(checkCodingMatchesType)
  .transform((task) => ({ ...task, maxAttempts: task.maxAttempts ?? DEFAULT_MAX_ATTEMPTS[task.type] }));
export type TaskInput = z.input<typeof taskInputSchema>;
export type ValidTask = z.output<typeof taskInputSchema>;

/**
 * PATCH body: any subset of the fields (e.g. `{ status: "published" }`). `coding: null` removes the coding
 * settings (needed when changing a coding task to another type). The merged task is re-validated in full.
 */
export const taskPatchSchema = z
  .strictObject({
    title: taskFields.title,
    type: taskFields.type,
    description: taskFields.description,
    dueAt: taskFields.dueAt,
    status: taskFields.status,
    maxAttempts: taskFields.maxAttempts,
    coding: taskFields.coding.nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to update.");
export type TaskPatch = z.infer<typeof taskPatchSchema>;

/** A task as the API returns it: dates as ISO strings. */
export type TaskDto = ValidTask & {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
