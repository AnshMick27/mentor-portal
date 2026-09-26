"use client";

import { z } from "zod";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { TaskList } from "@/components/tasks/TaskList";
import { useApiQuery } from "@/components/useApiQuery";
import { taskDtoSchema } from "@/lib/validation/task";

const listSchema = z.object({ tasks: z.array(taskDtoSchema) });

export default function MentorTasksPage() {
  const profile = useSignedInProfile();
  const { state, reload } = useApiQuery("/api/tasks", listSchema);
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  return <TaskList tasks={state.data.tasks} canEdit={profile.role === "mentor"} />;
}
