"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";
import { StudentProfile } from "@/components/mentor/StudentProfile";
import { QueryStatus } from "@/components/QueryStatus";
import { useAsyncData } from "@/components/useAsyncData";
import { useNow } from "@/components/useNow";
import { isValidUid } from "@/lib/dashboard/profile";
import { loadStudentProfile, loadSubmissionPage, type StudentProfileData } from "@/lib/dashboard/profileQueries";
import { getClientDb } from "@/lib/firebase/client";

function NotFound() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold tracking-tight">Student not found</h1>
      <p className="opacity-80">There is no student with this link.</p>
      <Link href="/mentor" className="self-start font-medium text-blue-700 underline dark:text-blue-300">
        Back to the dashboard
      </Link>
    </section>
  );
}

/** Holds the loaded pages of attempts; "Load older attempts" appends the next 50. */
function LoadedProfile({ data }: { data: StudentProfileData }) {
  const now = useNow(15_000);
  const [pages, setPages] = useState(data.firstPage);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();

  const loadMore = useCallback(async () => {
    if (!pages.cursor) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const next = await loadSubmissionPage(getClientDb(), data.uid, pages.cursor);
      setPages((current) => ({ ...next, submissions: [...current.submissions, ...next.submissions] }));
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load older attempts. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [data.uid, pages.cursor]);

  return (
    <>
      <StudentProfile
        data={data}
        submissions={pages.submissions}
        now={now}
        hasMore={pages.cursor !== undefined}
        loadingMore={loadingMore}
        onLoadMore={() => void loadMore()}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </>
  );
}

function Profile({ uid }: { uid: string }) {
  const load = useCallback(() => loadStudentProfile(getClientDb(), uid), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load this student. Please try again.");
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  return state.data ? <LoadedProfile key={uid} data={state.data} /> : <NotFound />;
}

/** Mentor and viewer: one student's stats, tasks and every attempt, read-only. */
export default function StudentProfilePage({ params }: PageProps<"/mentor/students/[uid]">) {
  const { uid } = use(params);
  return isValidUid(uid) ? <Profile uid={uid} /> : <NotFound />;
}
