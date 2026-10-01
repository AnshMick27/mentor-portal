"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentTaskBoard } from "@/components/student/StudentTaskBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/components/useAsyncData";
import { getClientDb } from "@/lib/firebase/client";
import { groupStudentTasks, summarizeByTask } from "@/lib/tasks/studentBoard";
import { loadStudentBoard } from "@/lib/tasks/studentQueries";

export default function StudentTasksPage() {
  const { uid } = useSignedInProfile();
  const load = useCallback(() => loadStudentBoard(getClientDb(), uid), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load your tasks. Please try again.");
  return (
    <>
      <PageHeader title="My tasks" />
      {state.status === "ready" ? (
        <Board data={state.data} />
      ) : (
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading your tasks…" />
      )}
    </>
  );
}

function Board({ data }: { data: Awaited<ReturnType<typeof loadStudentBoard>> }) {
  const now = new Date();
  const progress = summarizeByTask(data.submissions, now);
  return <StudentTaskBoard board={groupStudentTasks(data.tasks, progress, now)} />;
}
