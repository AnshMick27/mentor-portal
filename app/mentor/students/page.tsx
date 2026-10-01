"use client";

import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { StudentList, StudentListHeader } from "@/components/mentor/StudentList";
import { QueryStatus, Refreshing } from "@/components/QueryStatus";
import { useAsyncData } from "@/components/useAsyncData";
import { getClientDb } from "@/lib/firebase/client";
import { loadStudentList } from "@/lib/students/listQuery";

/** Mentor and viewer: every student account; mentors can remove or restore (T34b). */
export default function StudentsPage() {
  const profile = useSignedInProfile();
  const load = useCallback(() => loadStudentList(getClientDb()), []);
  const { state, reload, refresh, refreshing } = useAsyncData(load, "Could not load the students. Please try again.");
  const canEdit = profile.role === "mentor";
  return (
    <>
      <StudentListHeader canEdit={canEdit} />
      {refreshing && <Refreshing />}
      {state.status === "ready" ? (
        <StudentList rows={state.data} canEdit={canEdit} onChanged={refresh} />
      ) : (
        <QueryStatus state={state} onRetry={reload} loadingLabel="Loading the students…" />
      )}
    </>
  );
}
