"use client";

import { z } from "zod";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { TaskList, TaskListHeader } from "@/components/tasks/TaskList";
import { useApiQuery } from "@/components/useApiQuery";
import { taskDtoSchema } from "@/lib/validation/task";

const listSchema = z.object({ tasks: z.array(taskDtoSchema) });

export default function MentorTasksPage() {
  const profile = useSignedInProfile();
  const { state, reload } = useApiQuery("/api/tasks", listSchema);
  const canEdit = profile.role === "mentor";
  return (
    <>
      <TaskListHeader canEdit={canEdit} />
      {state.status === "ready" ? (
        <TaskList tasks={state.data.tasks} canEdit={canEdit} />
      ) : (
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the tasks…" />
      )}
    </>
  );
}
