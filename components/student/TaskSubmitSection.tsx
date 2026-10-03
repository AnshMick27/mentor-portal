"use client";

import { Note } from "@/components/ui/Note";
import { submitAvailability } from "@/lib/submissions/availability";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { AiTaskType } from "@/lib/validation/submission";
import type { Language, TaskDto } from "@/lib/validation/task";
import { CodeSubmitForm } from "./CodeSubmitForm";
import { FeedbackReady, FeedbackSaved } from "./FeedbackSubmitParts";
import { IntroSubmitForm } from "./IntroSubmitForm";
import { ResumeSubmitForm } from "./ResumeSubmitForm";
import { JudgeStatus } from "./SubmissionHistory";
import { useCodeSubmit, type CodeSubmitState } from "./useCodeSubmit";
import { useFeedbackSubmit } from "./useFeedbackSubmit";

type SectionProps = { task: TaskDto; attemptsUsed: number; now: Date; submissions?: readonly SubmissionView[] };

/** The last attempt gets a warning: it cannot be undone (UX-10). Late work has no score, so no "best score" line. */
export function AttemptsLeft({ count, late = false }: { count: number; late?: boolean }) {
  if (count === 1) return <Note tone="warning">This is your last attempt. Check your work before you submit.</Note>;
  return <p className="text-sm text-muted">{late ? `${count} attempts left.` : `${count} attempts left. Your best score counts.`}</p>;
}

/** Past the due date (SPEC.md §8.2, T44): the form stays open, and the student knows up front it will not be scored. */
export function LateNote() {
  return (
    <Note tone="warning" title="Past the due date">
      This task is past its due date. You will get feedback, but it will not be scored.
    </Note>
  );
}

/** Right under the form after sending code: this attempt's live status, so nobody scrolls or sends it twice (UX-08). */
export function SentStatus({
  state,
  submissions,
  now,
}: {
  state: CodeSubmitState;
  submissions: readonly SubmissionView[];
  now: Date;
}) {
  if (state.status !== "sent") return null;
  const attempt = state.submissionId ? submissions.find((submission) => submission.id === state.submissionId) : undefined;
  return (
    <div className="flex flex-col gap-2">
      {attempt ? (
        <JudgeStatus submission={attempt} now={now} />
      ) : (
        <p role="status" className="text-sm">
          Sent to the judge. The status appears here in a moment.
        </p>
      )}
      <p className="text-sm text-muted">Full details are under “Your attempts” below.</p>
    </div>
  );
}

function ClosedNote({ reason }: { reason: string }) {
  return <Note tone="neutral">{reason}</Note>;
}

function CodeSubmitSection({ task, attemptsUsed, now, submissions = [] }: SectionProps) {
  const { state, submit } = useCodeSubmit(task.id);
  const availability = submitAvailability(task, attemptsUsed, now);
  const onSubmit = (language: Language, code: string) => void submit(language, code);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="submit-heading">
      <h2 id="submit-heading" className="text-lg font-semibold">
        Submit your code
      </h2>
      {availability.open ? (
        <>
          {availability.late && <LateNote />}
          <AttemptsLeft count={availability.attemptsLeft} late={availability.late} />
          <CodeSubmitForm languages={task.coding?.languages ?? []} state={state} onSubmit={onSubmit} />
          <SentStatus state={state} submissions={submissions} now={now} />
        </>
      ) : (
        <>
          <SentStatus state={state} submissions={submissions} now={now} />
          <ClosedNote reason={availability.reason} />
        </>
      )}
    </section>
  );
}

function AiSubmitSection({ task, type, attemptsUsed, now }: SectionProps & { type: AiTaskType }) {
  const { state, submit } = useFeedbackSubmit(task.id, type);
  const availability = submitAvailability(task, attemptsUsed, now);
  const onSubmit = (text: string) => void submit(text);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="submit-heading">
      <h2 id="submit-heading" className="text-lg font-semibold">
        {type === "resume" ? "Submit your resume" : "Submit your introduction"}
      </h2>
      {state.status === "done" && <FeedbackReady result={state.result} late={state.late} />}
      {state.status === "saved" && <FeedbackSaved />}
      {availability.open ? (
        <>
          {availability.late && <LateNote />}
          <AttemptsLeft count={availability.attemptsLeft} late={availability.late} />
          {type === "resume" ? (
            <ResumeSubmitForm state={state} onSubmit={onSubmit} />
          ) : (
            <IntroSubmitForm state={state} onSubmit={onSubmit} />
          )}
        </>
      ) : (
        <ClosedNote reason={availability.reason} />
      )}
    </section>
  );
}

/** The submit area of a task page: the right form for the task type, or why submitting is closed. */
export function TaskSubmitSection(props: SectionProps) {
  const { type } = props.task;
  if (type === "coding") return <CodeSubmitSection {...props} />;
  return <AiSubmitSection {...props} type={type} />;
}
