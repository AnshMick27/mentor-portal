import { ButtonLink } from "@/components/ui/Button";
import { cardClasses, CardLink } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatIst } from "@/lib/dates/ist";
import { TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";

export function StatusBadge({ status }: { status: TaskDto["status"] }) {
  return status === "published" ? (
    <StatusChip tone="success">Published</StatusChip>
  ) : (
    <StatusChip tone="warning">Draft</StatusChip>
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
          {tasks.map((task) => {
            const body = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-semibold break-words">{task.title}</span>
                  <StatusBadge status={task.status} />
                </span>
                <span className="text-sm text-muted">
                  {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
                </span>
              </>
            );
            // Mentors tap anywhere on the card to edit (UX-13); viewers get the same card without a link.
            return (
              <li key={task.id}>
                {canEdit ? (
                  <CardLink href={`/mentor/tasks/${task.id}`}>{body}</CardLink>
                ) : (
                  <div className={cardClasses({ className: "flex flex-col gap-1" })}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
