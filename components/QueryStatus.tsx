import { LoadingScreen } from "@/components/auth/RouteGuard";
import { Button } from "@/components/ui/Button";
import type { QueryState } from "@/components/useApiQuery";

/** Loading spinner or error box for a `useApiQuery` state; renders nothing once ready. */
export function QueryStatus<T>({ state, onRetry }: { state: QueryState<T>; onRetry: () => void }) {
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "ready") return null;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p>{state.message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
