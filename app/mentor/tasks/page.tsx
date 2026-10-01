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

/** After "Create task" the form comes here with `?created=1`: confirm it worked (UX-21). */
function CreatedNote() {
  const created = useSearchParams().get("created") === "1";
  if (!created) return null;
  return (
    <Note tone="success" live>
      Task created.
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
