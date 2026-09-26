"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryState } from "@/components/useApiQuery";

/**
 * Runs an async loader (e.g. a Firestore read) and tracks loading/error/ready. `load` must be stable
 * (wrap it in useCallback). Errors are logged and shown as a plain-English message.
 */
export function useAsyncData<T>(load: () => Promise<T>, errorMessage: string) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: errorMessage });
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
  return { state, reload };
}
