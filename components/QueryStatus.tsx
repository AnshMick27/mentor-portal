import { LoadingScreen } from "@/components/auth/RouteGuard";
import type { QueryState } from "@/components/useApiQuery";

/** Loading spinner or error box for a `useApiQuery` state; renders nothing once ready. */
export function QueryStatus<T>({ state, onRetry }: { state: QueryState<T>; onRetry: () => void }) {
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "ready") return null;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p>{state.message}</p>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-current px-4 font-medium">
        Try again
      </button>
    </div>
  );
}
