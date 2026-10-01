"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { StudentList } from "@/components/mentor/StudentList";
import { QueryStatus } from "@/components/QueryStatus";
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
      <Link href="/mentor" className="self-start text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
        ← Dashboard
      </Link>
      {state.status === "ready" ? (
        <StudentList rows={state.data} canEdit={profile.role === "mentor"} onChanged={reload} />
      ) : (
        <QueryStatus state={state} onRetry={reload} />
      )}
    </>
  );
}
