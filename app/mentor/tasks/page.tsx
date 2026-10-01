"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { TaskList, TaskListHeader } from "@/components/tasks/TaskList";
import { Note } from "@/components/ui/Note";
import { useApiQuery } from "@/components/useApiQuery";
import { taskDtoSchema } from "@/lib/validation/task";

const listSchema = z.object({ tasks: z.array(taskDtoSchema) });

/** After creating (`?created=1`, UX-21) or deleting (`?deleted=1`, T37) a task, confirm it worked. */
function CreatedNote() {
  const params = useSearchParams();
  const message = params.get("created") === "1" ? "Task created." : params.get("deleted") === "1" ? "Task deleted." : null;
  if (!message) return null;
  return (
    <Note tone="success" live>
      {message}
    </Note>
  );
}

export default function MentorTasksPage() {
  const profile = useSignedInProfile();
  const { state, reload } = useApiQuery("/api/tasks", listSchema);
  const canEdit = profile.role === "mentor";
  return (
    <>
      <TaskListHeader canEdit={canEdit} />
      {/* useSearchParams needs a Suspense boundary so the rest of the page can still be prerendered. */}
      <Suspense fallback={null}>
        <CreatedNote />
      </Suspense>
      {state.status === "ready" ? (
        <TaskList tasks={state.data.tasks} canEdit={canEdit} />
      ) : (
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the tasks…" />
      )}
    </>
  );
}
