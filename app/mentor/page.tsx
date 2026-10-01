"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ExportButton } from "@/components/mentor/ExportButton";
import { LeaderboardSetting } from "@/components/mentor/LeaderboardSetting";
import { MentorDashboard } from "@/components/mentor/MentorDashboard";
import { QueryStatus } from "@/components/QueryStatus";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAsyncData } from "@/components/useAsyncData";
import { loadMentorDashboard } from "@/lib/dashboard/mentorQueries";
import { getClientDb } from "@/lib/firebase/client";

export default function MentorHomePage() {
  const profile = useSignedInProfile();
  const load = useCallback(() => loadMentorDashboard(getClientDb()), []);
  const { state, reload } = useAsyncData(load, "Could not load the dashboard. Please try again.");
  return (
    <>
      <PageHeader
        title="Mentor dashboard"
        tabTitle="Dashboard"
        subtitle={profile.role === "viewer" ? "Read-only view" : `Welcome, ${profile.name}`}
        actions={
          <>
            <ButtonLink href="/mentor/tasks">{profile.role === "mentor" ? "Manage tasks" : "View tasks"}</ButtonLink>
            <ButtonLink href="/mentor/students" variant="secondary">
              Students
            </ButtonLink>
            <ExportButton />
          </>
        }
      />
      <div className="flex flex-col gap-8">
        {state.status === "ready" ? (
          <MentorDashboard data={state.data} />
        ) : (
          <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the dashboard…" />
        )}
        {profile.role === "mentor" && <LeaderboardSetting />}
      </div>
    </>
  );
}
