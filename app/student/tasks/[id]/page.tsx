"use client";

import { use, useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { useOwnTaskSubmissions } from "@/components/student/useOwnTaskSubmissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/TextLink";
import { useAsyncData } from "@/components/useAsyncData";
import { useNow } from "@/components/useNow";
import { getClientDb } from "@/lib/firebase/client";
import { loadStudentTask } from "@/lib/tasks/studentQueries";
import { isValidTaskId } from "@/lib/validation/task";

/** The title is only known once the task loads, so keep the back link in place and say what is loading. */
function Loading({ state, onRetry }: { state: Parameters<typeof QueryStatus>[0]["state"]; onRetry: () => void }) {
  return (
    <>
      <BackLink href="/student/tasks">My tasks</BackLink>
      <QueryStatus state={state} onRetry={onRetry} loadingLabel="Loading the task…" />
    </>
  );
}

export default function StudentTaskPage({ params }: PageProps<"/student/tasks/[id]">) {
  const { id } = use(params);
  const { uid } = useSignedInProfile();
  const load = useCallback(async () => (isValidTaskId(id) ? loadStudentTask(getClientDb(), id) : undefined), [id]);
  const { state, reload } = useAsyncData(load, "Could not load this task. Please try again.");
  const hasTask = state.status === "ready" && state.data !== undefined;
  const history = useOwnTaskSubmissions(uid, id, hasTask);
  // Ticks so an attempt stuck > 10 minutes flips to "Judge timed out" without a reload.
  const now = useNow(15_000);

  if (state.status !== "ready") return <Loading state={state} onRetry={reload} />;
  const task = state.data;
  if (!task) {
    return (
      <>
        <PageHeader title="Task not found" back={{ href: "/student/tasks", label: "My tasks" }} />
        <p>This task does not exist or is not available yet.</p>
      </>
    );
  }
  if (history.state.status !== "ready") return <Loading state={history.state} onRetry={history.retry} />;
  return <StudentTaskDetail task={task} submissions={history.state.data} now={now} />;
}
