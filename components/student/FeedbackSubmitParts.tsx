import type { SubmissionResult } from "@/lib/validation/submission";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";

export const textareaClass =
  "w-full rounded-lg border border-black/20 bg-transparent p-3 text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/25";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50";

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {message}
    </p>
  );
}

/** Submit button plus the progress or error note below it. */
export function SubmitFooter({ state, disabled }: { state: FeedbackSubmitState; disabled: boolean }) {
  const submitting = state.status === "submitting";
  return (
    <div className="flex flex-col gap-3">
      <button type="submit" disabled={disabled || submitting} className={buttonClass}>
        {submitting ? "Getting feedback…" : "Submit for feedback"}
      </button>
      {submitting && (
        <p role="status" className="text-sm opacity-80">
          The AI is reading your text. This can take up to a minute; please keep this page open.
        </p>
      )}
      {state.status === "error" && <ErrorNote message={state.message} />}
    </div>
  );
}

/** Short note after a successful submit; the full feedback is in the attempt history below. */
export function FeedbackReady({ result }: { result: SubmissionResult }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
    >
      <span className="text-base font-semibold">Feedback ready: {result.score.toFixed(1)} / 10</span>
      <span>{result.summary}</span>
      <span className="opacity-80">Full feedback is under “Your attempts” below.</span>
    </div>
  );
}
