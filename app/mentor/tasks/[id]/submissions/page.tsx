"use client";

import { use, useCallback, useState } from "react";
import { TaskSubmissionsView } from "@/components/mentor/TaskSubmissions";
import { QueryStatus } from "@/components/QueryStatus";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/components/useAsyncData";
import { useNow } from "@/components/useNow";
import type { BranchFilter } from "@/lib/dashboard/mentor";
import { getClientDb } from "@/lib/firebase/client";
import { loadTaskRoster } from "@/lib/tasks/rosterQuery";
import { isValidTaskId } from "@/lib/validation/task";

const back = { href: "/mentor/tasks", label: "Tasks" };

function NotFound() {
  return (
    <>
      <PageHeader title="Task not found" back={back} />
      <p>There is no task with this link.</p>
    </>
  );
}

function Roster({ id }: { id: string }) {
  const load = useCallback(() => loadTaskRoster(getClientDb(), id), [id]);
  const { state, reload } = useAsyncData(load, "Could not load the submissions. Please try again.");
  const [branch, setBranch] = useState<BranchFilter>("all");
  const now = useNow(15_000);
  if (state.status !== "ready") {
    return (
      <>
        <PageHeader title="Submissions" back={back} />
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the submissions…" />
      </>
    );
  }
  if (!state.data) return <NotFound />;
  return (
    <>
      <PageHeader title={state.data.task.title} tabTitle="Submissions" subtitle="Who has submitted and who has not." back={back} />
      <TaskSubmissionsView data={state.data} branch={branch} onBranch={setBranch} now={now} />
    </>
  );
}

/** Mentor and viewer: who has and has not submitted one task, read live from its submissions. */
export default function TaskSubmissionsPage({ params }: PageProps<"/mentor/tasks/[id]/submissions">) {
  const { id } = use(params);
  return isValidTaskId(id) ? <Roster id={id} /> : <NotFound />;
}
