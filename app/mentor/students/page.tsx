"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { StudentList } from "@/components/mentor/StudentList";
import { QueryStatus } from "@/components/QueryStatus";
import { BackLink } from "@/components/ui/TextLink";
import { useAsyncData } from "@/components/useAsyncData";
import { getClientDb } from "@/lib/firebase/client";
import { loadStudentList } from "@/lib/students/listQuery";

/** Mentor and viewer: every student account; mentors can remove or restore (T34b). */
export default function StudentsPage() {
  const profile = useSignedInProfile();
  const load = useCallback(() => loadStudentList(getClientDb()), []);
  const { state, reload } = useAsyncData(load, "Could not load the students. Please try again.");
  return (
    <>
      <BackLink href="/mentor">Dashboard</BackLink>
      {state.status === "ready" ? (
        <StudentList rows={state.data} canEdit={profile.role === "mentor"} onChanged={reload} />
      ) : (
        <QueryStatus state={state} onRetry={reload} />
      )}
    </>
  );
}
