"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryState } from "@/components/useApiQuery";

/**
 * Runs an async loader (e.g. a Firestore read) and tracks loading/error/ready. `load` must be stable
 * (wrap it in useCallback). Errors are logged and shown as a plain-English message.
 * `reload` starts over with "Loading…"; `refresh` keeps showing the current data while it fetches again
 * (`refreshing` is true meanwhile), so lists keep their search box and scroll position (UX-12).
 */
export function useAsyncData<T>(load: () => Promise<T>, errorMessage: string) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (cancelled) return;
        setState({ status: "ready", data });
        setRefreshing(false);
      },
      (error: unknown) => {
        console.error(error);
        if (cancelled) return;
        setState({ status: "error", message: errorMessage });
        setRefreshing(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, errorMessage, version]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setVersion((v) => v + 1);
  }, []);
  return { state, reload, refresh, refreshing };
}
