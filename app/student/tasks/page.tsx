"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentTaskBoard } from "@/components/student/StudentTaskBoard";
import { useAsyncData } from "@/components/useAsyncData";
import { getClientDb } from "@/lib/firebase/client";
import { groupStudentTasks } from "@/lib/tasks/studentBoard";
import { loadStudentBoard } from "@/lib/tasks/studentQueries";

export default function StudentTasksPage() {
  const { uid } = useSignedInProfile();
  const load = useCallback(() => loadStudentBoard(getClientDb(), uid), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load your tasks. Please try again.");
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  return <StudentTaskBoard board={groupStudentTasks(state.data.tasks, state.data.attempts, new Date())} />;
}
