"use client";

import { use } from "react";
import { z } from "zod";
import { QueryStatus } from "@/components/QueryStatus";
import { MentorOnly } from "@/components/tasks/MentorOnly";
import { TaskForm } from "@/components/tasks/TaskForm";
import { StatusBadge } from "@/components/tasks/TaskList";
import { useApiQuery } from "@/components/useApiQuery";
import { taskToForm } from "@/lib/tasks/taskForm";
import { taskDtoSchema } from "@/lib/validation/task";

const taskResponseSchema = z.object({ task: taskDtoSchema });

function EditTask({ id }: { id: string }) {
  const { state, reload } = useApiQuery(`/api/tasks/${encodeURIComponent(id)}`, taskResponseSchema);
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  const { task } = state.data;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">Edit task</h1>
        <StatusBadge status={task.status} />
      </div>
      <TaskForm key={task.updatedAt} mode="edit" taskId={task.id} initial={taskToForm(task)} />
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
