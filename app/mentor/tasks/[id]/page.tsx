"use client";

import { use } from "react";
import { z } from "zod";
import { QueryStatus } from "@/components/QueryStatus";
import { DeleteTask } from "@/components/tasks/DeleteTask";
import { MentorOnly } from "@/components/tasks/MentorOnly";
import { TaskForm } from "@/components/tasks/TaskForm";
import { StatusBadge } from "@/components/tasks/TaskList";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApiQuery } from "@/components/useApiQuery";
import { taskToForm } from "@/lib/tasks/taskForm";
import { taskDtoSchema } from "@/lib/validation/task";

const taskResponseSchema = z.object({ task: taskDtoSchema, hasSubmissions: z.boolean().default(false) });

function EditTask({ id }: { id: string }) {
  const { state, reload } = useApiQuery(`/api/tasks/${encodeURIComponent(id)}`, taskResponseSchema);
  const back = { href: "/mentor/tasks", label: "Tasks" };
  if (state.status !== "ready") {
    return (
      <>
        <PageHeader title="Edit task" back={back} />
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the task…" />
      </>
    );
  }
  const { task, hasSubmissions } = state.data;
  return (
    <>
      <PageHeader title="Edit task" back={back} badge={<StatusBadge status={task.status} />} />
      <TaskForm
        key={task.updatedAt}
        mode="edit"
        taskId={task.id}
        initial={taskToForm(task)}
        hasSubmissions={hasSubmissions}
      />
      <DeleteTask taskId={task.id} title={task.title} hasSubmissions={hasSubmissions} />
    </>
  );
}

export default function EditTaskPage({ params }: PageProps<"/mentor/tasks/[id]">) {
  const { id } = use(params);
  return (
    <MentorOnly>
      <EditTask id={id} />
    </MentorOnly>
  );
}
