"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { QueryStatus } from "@/components/QueryStatus";
import { StudentDashboard } from "@/components/student/StudentDashboard";
import { StudentLeaderboard } from "@/components/student/StudentLeaderboard";
import { useAsyncData } from "@/components/useAsyncData";
import { loadStudentDashboard } from "@/lib/dashboard/studentQueries";
import { getClientDb } from "@/lib/firebase/client";

export default function StudentHomePage() {
  const { uid, name } = useSignedInProfile();
  const load = useCallback(() => loadStudentDashboard(getClientDb(), uid, new Date()), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load your dashboard. Please try again.");
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  return (
    <>
      <StudentDashboard name={name} data={state.data} />
      <StudentLeaderboard />
    </>
  );
}
