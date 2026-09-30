"use client";

import { submitAvailability } from "@/lib/submissions/availability";
import type { AiTaskType } from "@/lib/validation/submission";
import type { Language, TaskDto } from "@/lib/validation/task";
import { CodeSubmitForm } from "./CodeSubmitForm";
import { FeedbackReady } from "./FeedbackSubmitParts";
import { IntroSubmitForm } from "./IntroSubmitForm";
import { ResumeSubmitForm } from "./ResumeSubmitForm";
import { useCodeSubmit } from "./useCodeSubmit";
import { useFeedbackSubmit } from "./useFeedbackSubmit";

type SectionProps = { task: TaskDto; attemptsUsed: number; now: Date };

function AttemptsLeft({ count }: { count: number }) {
  return (
    <p className="text-sm opacity-80">
      {count} {count === 1 ? "attempt" : "attempts"} left. Your best score counts.
    </p>
  );
}

function ClosedNote({ reason }: { reason: string }) {
  return <p className="rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/15">{reason}</p>;
}

function CodeSubmitSection({ task, attemptsUsed, now }: SectionProps) {
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
          <AttemptsLeft count={availability.attemptsLeft} />
          <CodeSubmitForm languages={task.coding?.languages ?? []} state={state} onSubmit={onSubmit} />
        </>
      ) : (
        <>
          {state.status === "sent" && <p role="status" className="text-sm">Sent to the judge. Watch the status below.</p>}
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
      {state.status === "done" && <FeedbackReady result={state.result} />}
      {availability.open ? (
        <>
          <AttemptsLeft count={availability.attemptsLeft} />
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
