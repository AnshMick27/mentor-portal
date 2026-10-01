import { LoadingScreen } from "@/components/auth/RouteGuard";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import type { QueryState } from "@/components/useApiQuery";

/** Loading line or error box for a `useApiQuery` state; renders nothing once ready. Pages render their header above it. */
export function QueryStatus<T>({
  state,
  onRetry,
  loadingLabel,
}: {
  state: QueryState<T>;
  onRetry: () => void;
  /** e.g. "Loading your tasks…"; defaults to "Loading…". */
  loadingLabel?: string;
}) {
  if (state.status === "loading") return <LoadingScreen label={loadingLabel} />;
  if (state.status === "ready") return null;
  return (
    <Note tone="danger" className="items-start gap-3 text-base">
      <p>{state.message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </Note>
  );
}
