import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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

/** Page header; the "New task" button only for mentors. Rendered by the page so it stays while the list loads. */
export function TaskListHeader({ canEdit }: { canEdit: boolean }) {
  return <PageHeader title="Tasks" actions={canEdit && <ButtonLink href="/mentor/tasks/new">New task</ButtonLink>} />;
}

/** Mentor/viewer task list. `canEdit` false (viewers) hides every create/edit control. */
export function TaskList({ tasks, canEdit }: { tasks: TaskDto[]; canEdit: boolean }) {
  return (
    <section className="flex flex-col gap-4">
      {tasks.length === 0 ? (
        <EmptyState action={canEdit && <ButtonLink href="/mentor/tasks/new">Create your first task</ButtonLink>}>No tasks yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id} className={cardClasses()}>
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
