"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api/client";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/** GETs one of our API routes with the user's ID token and validates the reply. `reload()` fetches again. */
export function useApiQuery<S extends z.ZodType>(path: string, schema: S) {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<QueryState<z.output<S>>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void apiFetch(getIdToken, path).then((result) => {
      if (cancelled) return;
      if (!result.ok) return setState({ status: "error", message: result.message });
      const parsed = schema.safeParse(result.data);
      setState(
        parsed.success
          ? { status: "ready", data: parsed.data }
          : { status: "error", message: "The server sent an unexpected reply. Please reload the page." },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [getIdToken, path, schema, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
