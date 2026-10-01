import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import type { SubmissionResult } from "@/lib/validation/submission";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";

export const textareaClass =
  "w-full rounded-lg border border-black/20 bg-transparent p-3 text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/25";

export function ErrorNote({ message }: { message: string }) {
  return (
    <Note tone="danger">{message}</Note>
  );
}

/** Submit button plus the progress or error note below it. */
export function SubmitFooter({ state, disabled }: { state: FeedbackSubmitState; disabled: boolean }) {
  const submitting = state.status === "submitting";
  return (
    <div className="flex flex-col gap-3">
      <Button type="submit" disabled={disabled} busy={submitting} busyLabel="Getting feedback…">
        Submit for feedback
      </Button>
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
    <Note tone="success" live title={`Feedback ready: ${result.score.toFixed(1)} / 10`}>
      <p>{result.summary}</p>
      <p>Full feedback is under “Your attempts” below.</p>
    </Note>
  );
}

/** The attempt was saved but its reply could not be read here; never shown as an error (UX-09). */
export function FeedbackSaved() {
  return (
    <Note tone="success" live>
      Your feedback is ready. You can read it under “Your attempts” below.
    </Note>
  );
}
