import { TASK_TYPE_LABEL, type TaskType } from "@/lib/validation/task";

const TONE: Record<TaskType, string> = {
  coding: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  resume: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
  intro_written: "bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100",
};

/** The task's kind as a small square tag ("Coding"), kept apart from the round status chips (Stitch design, T40b). */
export function TaskTypeTag({ type }: { type: TaskType }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ${TONE[type]}`}>
      {TASK_TYPE_LABEL[type]}
    </span>
  );
}
