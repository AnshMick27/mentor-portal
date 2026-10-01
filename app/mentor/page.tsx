"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ExportButton } from "@/components/mentor/ExportButton";
import { LeaderboardSetting } from "@/components/mentor/LeaderboardSetting";
import { MentorDashboard } from "@/components/mentor/MentorDashboard";
import { QueryStatus } from "@/components/QueryStatus";
import { ButtonLink } from "@/components/ui/Button";
import { useAsyncData } from "@/components/useAsyncData";
import { loadMentorDashboard } from "@/lib/dashboard/mentorQueries";
import { getClientDb } from "@/lib/firebase/client";

export default function MentorHomePage() {
  const profile = useSignedInProfile();
  const load = useCallback(() => loadMentorDashboard(getClientDb()), []);
  const { state, reload } = useAsyncData(load, "Could not load the dashboard. Please try again.");
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Mentor dashboard</h1>
          <p className="text-sm opacity-75">
            {profile.role === "viewer" ? "Read-only view" : `Welcome, ${profile.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <ButtonLink href="/mentor/tasks">{profile.role === "mentor" ? "Manage tasks" : "View tasks"}</ButtonLink>
          <ButtonLink href="/mentor/students" variant="secondary">
            Students
          </ButtonLink>
          <ExportButton />
        </div>
      </div>
      {state.status === "ready" ? <MentorDashboard data={state.data} /> : <QueryStatus state={state} onRetry={reload} />}
      {profile.role === "mentor" && <LeaderboardSetting />}
    </>
  );
}
