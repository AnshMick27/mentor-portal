import Link from "next/link";
import { formatIst } from "@/lib/dates/ist";
import { TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";

export function StatusBadge({ status }: { status: TaskDto["status"] }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        published
          ? "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
          : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

/** Mentor/viewer task list. `canEdit` false (viewers) hides every create/edit control. */
export function TaskList({ tasks, canEdit }: { tasks: TaskDto[]; canEdit: boolean }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        {canEdit && (
          <Link
            href="/mentor/tasks/new"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            New task
          </Link>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="opacity-70">No tasks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
              <div className="flex items-start justify-between gap-3">
                {canEdit ? (
                  <Link
                    href={`/mentor/tasks/${task.id}`}
                    className="min-w-0 font-semibold break-words underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    {task.title}
                  </Link>
                ) : (
                  <span className="min-w-0 font-semibold break-words">{task.title}</span>
                )}
                <StatusBadge status={task.status} />
              </div>
              <p className="mt-1 text-sm opacity-75">
                {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
