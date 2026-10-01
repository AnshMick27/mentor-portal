"use client";

import { use, useCallback, useState } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { RemoveStudentButton } from "@/components/mentor/RemoveStudentButton";
import { StudentProfile } from "@/components/mentor/StudentProfile";
import { QueryStatus } from "@/components/QueryStatus";
import { Note } from "@/components/ui/Note";
import { BackLink } from "@/components/ui/TextLink";
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
      <BackLink href="/mentor/students">Students</BackLink>
    </section>
  );
}

/** Holds the loaded pages of attempts; "Load older attempts" appends the next 50. */
function LoadedProfile({ data, onChanged }: { data: StudentProfileData; onChanged: () => void }) {
  const viewer = useSignedInProfile();
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
        actions={
          viewer.role === "mentor" ? (
            <RemoveStudentButton uid={data.uid} name={data.user.name} removed={data.user.removed === true} onChanged={onChanged} />
          ) : undefined
        }
      />
      {error && (
        <Note tone="danger">{error}</Note>
      )}
    </>
  );
}

function Profile({ uid }: { uid: string }) {
  const load = useCallback(() => loadStudentProfile(getClientDb(), uid), [uid]);
  const { state, reload } = useAsyncData(load, "Could not load this student. Please try again.");
  if (state.status !== "ready") return <QueryStatus state={state} onRetry={reload} />;
  return state.data ? <LoadedProfile key={uid} data={state.data} onChanged={reload} /> : <NotFound />;
}

/** Mentor and viewer: one student's stats, tasks and every attempt; mentors can also remove or restore them. */
export default function StudentProfilePage({ params }: PageProps<"/mentor/students/[uid]">) {
  const { uid } = use(params);
  return isValidUid(uid) ? <Profile uid={uid} /> : <NotFound />;
}
