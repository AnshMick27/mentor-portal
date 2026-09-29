"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryState } from "@/components/useApiQuery";
import { getClientDb } from "@/lib/firebase/client";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { watchOwnTaskSubmissions } from "@/lib/tasks/studentQueries";

/**
 * Live list of the signed-in student's attempts on one task (a Firestore listener, SPEC.md §8.3), so a new
 * attempt and its result appear without reloading. Pass `enabled: false` until the task is known to exist.
 */
export function useOwnTaskSubmissions(uid: string, taskId: string, enabled: boolean) {
  const [state, setState] = useState<QueryState<SubmissionView[]>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return watchOwnTaskSubmissions(
      getClientDb(),
      uid,
      taskId,
      (submissions) => setState({ status: "ready", data: submissions }),
      (error) => {
        console.error(error);
        setState({ status: "error", message: "Could not load your attempts. Please try again." });
      },
    );
  }, [uid, taskId, enabled, version]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);
  return { state, retry };
}
