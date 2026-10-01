"use client";

import { use, useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { useOwnTaskSubmissions } from "@/components/student/useOwnTaskSubmissions";
import { BackLink } from "@/components/ui/TextLink";
import { useAsyncData } from "@/components/useAsyncData";
import { useNow } from "@/components/useNow";
import { getClientDb } from "@/lib/firebase/client";
import { loadStudentTask } from "@/lib/tasks/studentQueries";
import { isValidTaskId } from "@/lib/validation/task";

export default function StudentTaskPage({ params }: PageProps<"/student/tasks/[id]">) {
  const { id } = use(params);
  const { uid } = useSignedInProfile();
  const load = useCallback(async () => (isValidTaskId(id) ? loadStudentTask(getClientDb(), id) : undefined), [id]);
  const { state, reload } = useAsyncData(load, "Could not load this task. Please try again.");
  const hasTask = state.status === "ready" && state.data !== undefined;
  const history = useOwnTaskSubmissions(uid, id, hasTask);
  // Ticks so an attempt stuck > 10 minutes flips to "Judge timed out" without a reload.
  const now = useNow(15_000);

  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  const task = state.data;
  if (!task) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Task not found</h1>
        <p className="opacity-80">This task does not exist or is not available yet.</p>
        <BackLink href="/student/tasks">My tasks</BackLink>
      </section>
    );
  }
  if (history.state.status !== "ready") return <QueryStatus state={history.state} onRetry={history.retry} />;
  return <StudentTaskDetail task={task} submissions={history.state.data} now={now} />;
}
