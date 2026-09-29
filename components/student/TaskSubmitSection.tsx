"use client";

import { submitAvailability } from "@/lib/submissions/availability";
import type { AiTaskType } from "@/lib/validation/submission";
import type { TaskDto } from "@/lib/validation/task";
import { buttonClass, FeedbackReady } from "./FeedbackSubmitParts";
import { IntroSubmitForm } from "./IntroSubmitForm";
import { ResumeSubmitForm } from "./ResumeSubmitForm";
import { useFeedbackSubmit } from "./useFeedbackSubmit";

type SectionProps = { task: TaskDto; attemptsUsed: number; now: Date };

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
          <p className="text-sm opacity-80">
            {availability.attemptsLeft} {availability.attemptsLeft === 1 ? "attempt" : "attempts"} left. Your best score
            counts.
          </p>
          {type === "resume" ? (
            <ResumeSubmitForm state={state} onSubmit={onSubmit} />
          ) : (
            <IntroSubmitForm state={state} onSubmit={onSubmit} />
          )}
        </>
      ) : (
        <p className="rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/15">{availability.reason}</p>
      )}
    </section>
  );
}

/** The submit area of a task page: the right form for the task type, or why submitting is closed. */
export function TaskSubmitSection(props: SectionProps) {
  const { type } = props.task;
  if (type === "coding") {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled className={buttonClass}>
          Submit
        </button>
        <p className="text-sm opacity-70">Coming soon: code submissions open in the next update.</p>
      </div>
    );
  }
  return <AiSubmitSection {...props} type={type} />;
}
