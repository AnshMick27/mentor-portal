"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cardClasses, CardLink } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClasses } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
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
  return (
    <PageHeader
      title="Tasks"
      subtitle={canEdit ? "Create tasks, publish them, and see who has submitted." : "Read-only view."}
      actions={canEdit && <ButtonLink href="/mentor/tasks/new">+ New task</ButtonLink>}
    />
  );
}

type Filter = "all" | TaskDto["status"];

const FILTER_LABEL: Record<Filter, string> = { all: "All", published: "Published", draft: "Drafts" };

/** Tasks shown for a filter and a title search (case-insensitive, trimmed). */
export function filterTasks(tasks: readonly TaskDto[], filter: Filter, search: string): TaskDto[] {
  const needle = search.trim().toLowerCase();
  return tasks.filter(
    (task) => (filter === "all" || task.status === filter) && (needle === "" || task.title.toLowerCase().includes(needle)),
  );
}

function Chevron() {
  return (
    <span aria-hidden="true" className="shrink-0 self-center text-xl leading-none text-muted">
      ›
    </span>
  );
}

function TaskRow({ task, canEdit }: { task: TaskDto; canEdit: boolean }) {
  const body = (
    <span className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold break-words">{task.title}</span>
        <span className="text-sm text-muted">
          {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <StatusBadge status={task.status} />
        {(canEdit || task.status === "published") && <Chevron />}
      </span>
    </span>
  );
  // Mentors tap anywhere on the card to edit (UX-13); viewers tap it to see who submitted.
  const submissionsHref = `/mentor/tasks/${task.id}/submissions`;
  return (
    <li className="flex flex-col">
      {canEdit ? (
        <CardLink href={`/mentor/tasks/${task.id}`}>{body}</CardLink>
      ) : task.status === "published" ? (
        <CardLink href={submissionsHref}>{body}</CardLink>
      ) : (
        <div className={cardClasses({ className: "flex flex-col gap-1" })}>{body}</div>
      )}
      {canEdit && task.status === "published" && (
        <TextLink href={submissionsHref} className="inline-flex min-h-11 items-center gap-1 self-start px-4 text-sm">
          See who submitted <span aria-hidden="true">→</span>
        </TextLink>
      )}
    </li>
  );
}

/** Mentor/viewer task list. `canEdit` false (viewers) hides every create/edit control. */
export function TaskList({ tasks, canEdit }: { tasks: TaskDto[]; canEdit: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  if (tasks.length === 0) {
    return (
      <EmptyState action={canEdit && <ButtonLink href="/mentor/tasks/new">Create your first task</ButtonLink>}>No tasks yet.</EmptyState>
    );
  }
  const published = tasks.filter((task) => task.status === "published").length;
  const counts: Record<Filter, number> = { all: tasks.length, published, draft: tasks.length - published };
  const shown = filterTasks(tasks, filter, search);
  return (
    <section className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3">
        <div className={cardClasses()}>
          <Stat label="Total" value={counts.all} />
        </div>
        <div className={cardClasses()}>
          <Stat label="Published" value={counts.published} />
        </div>
        <div className={cardClasses()}>
          <Stat label="Drafts" value={counts.draft} />
        </div>
      </dl>

      <div className={cardClasses({ padding: "sm", className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" })}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium sm:max-w-sm">
          <span className="sr-only">Search tasks by title</span>
          <input
            type="search"
            value={search}
            placeholder="Search tasks by title…"
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClasses} bg-surface font-normal`}
          />
        </label>
        <div role="group" aria-label="Show" className="flex gap-1">
          {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors ${
                filter === key ? "bg-primary text-white" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {FILTER_LABEL[key]} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState>No task matches.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}
