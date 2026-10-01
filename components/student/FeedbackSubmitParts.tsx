import { Button } from "@/components/ui/Button";
import { textareaClasses } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import type { SubmissionResult } from "@/lib/validation/submission";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";

export const textareaClass = textareaClasses;

export function ErrorNote({ message }: { message: string }) {
  return (
    <Note tone="danger">{message}</Note>
  );
}

/** Screen-reader-only status that speaks only when its message changes (a limit crossed), not on every key. */
export function LimitStatus({ message }: { message: string }) {
  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  );
}

/** Why a Submit button is greyed out, linked to it with `aria-describedby` so it never just looks broken (UX-10). */
export function DisabledReason({ id, reason }: { id: string; reason?: string }) {
  if (!reason) return null;
  return (
    <p id={id} className="text-sm text-muted">
      {reason}
    </p>
  );
}

/** Submit button plus the reason it is disabled, or the progress or error note below it. */
export function SubmitFooter({ state, disabledReason }: { state: FeedbackSubmitState; disabledReason?: string }) {
  const submitting = state.status === "submitting";
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="submit"
        disabled={disabledReason !== undefined}
        busy={submitting}
        busyLabel="Getting feedback…"
        aria-describedby={disabledReason && !submitting ? "submit-reason" : undefined}
      >
        Submit for feedback
      </Button>
      {!submitting && <DisabledReason id="submit-reason" reason={disabledReason} />}
      {submitting && (
        <p role="status" className="text-sm text-muted">
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
