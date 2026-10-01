"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentDashboard } from "@/components/student/StudentDashboard";
import { StudentLeaderboard } from "@/components/student/StudentLeaderboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/components/useAsyncData";
import { loadStudentDashboard } from "@/lib/dashboard/studentQueries";
import { getClientDb } from "@/lib/firebase/client";

export default function StudentHomePage() {
  const { uid, name } = useSignedInProfile();
  const load = useCallback(() => loadStudentDashboard(getClientDb(), uid, new Date()), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load your dashboard. Please try again.");
  return (
    <>
      <PageHeader title={`Hi, ${name}`} tabTitle="Home" subtitle="Your progress and what is due this week." />
      {state.status === "ready" ? (
        <>
          <StudentDashboard data={state.data} />
          <StudentLeaderboard />
        </>
      ) : (
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading your dashboard…" />
      )}
    </>
  );
}
