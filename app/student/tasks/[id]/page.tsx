"use client";

import Link from "next/link";
import { use, useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { useAsyncData } from "@/components/useAsyncData";
import { getClientDb } from "@/lib/firebase/client";
import { loadStudentTask } from "@/lib/tasks/studentQueries";
import { isValidTaskId } from "@/lib/validation/task";

export default function StudentTaskPage({ params }: PageProps<"/student/tasks/[id]">) {
  const { id } = use(params);
  const { uid } = useSignedInProfile();
  const load = useCallback(
    async () => (isValidTaskId(id) ? loadStudentTask(getClientDb(), uid, id) : { task: undefined, attemptsUsed: 0 }),
    [uid, id],
  );
  const { state, reload } = useAsyncData(load, "Could not load this task. Please try again.");
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;

  const { task, attemptsUsed } = state.data;
  if (!task) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Task not found</h1>
        <p className="opacity-80">This task does not exist or is not available yet.</p>
        <Link href="/student/tasks" className="self-start font-medium text-blue-700 underline dark:text-blue-300">
          Back to your tasks
        </Link>
      </section>
    );
  }
  return <StudentTaskDetail task={task} attemptsUsed={attemptsUsed} now={new Date()} />;
}
