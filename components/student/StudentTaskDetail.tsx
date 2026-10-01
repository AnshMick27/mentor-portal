import { Markdown } from "@/components/Markdown";
import { SubmissionHistory } from "@/components/student/SubmissionHistory";
import { TaskSubmitSection } from "@/components/student/TaskSubmitSection";
import { ButtonLink } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { dueText } from "@/components/ui/dueText";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { StatusChip } from "@/components/ui/StatusChip";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { submitAvailability } from "@/lib/submissions/availability";
import { taskProgress } from "@/lib/tasks/studentBoard";
import { LANGUAGE_LABEL, TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";
import { progressText, taskChip } from "./taskStatus";

function Sample({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <pre className="overflow-x-auto rounded-lg bg-black/[0.05] p-3 font-mono text-sm dark:bg-white/[0.08]">{text}</pre>
    </div>
  );
}

/** Task view for students: description, sample tests and the submit area. */
export function StudentTaskDetail({
  task,
  submissions,
  now,
}: {
  task: TaskDto;
  submissions: readonly SubmissionView[];
  now: Date;
}) {
  const progress = taskProgress(submissions, now);
  const studentTask = { ...task, ...progress };
  const chip = taskChip(studentTask, now);
  const open = submitAvailability(task, progress.attemptsUsed, now).open;
  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        back={{ href: "/student/tasks", label: "My tasks" }}
        subtitle={
          <div className="flex flex-col items-start gap-2">
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
            <p>
              {TASK_TYPE_LABEL[task.type]} · {dueText(task.dueAt, now)}
            </p>
            <p>{progressText(studentTask, formatScore)}</p>
            {open && (
              <ButtonLink href="#submit-heading" variant="secondary" size="sm">
                Go to submit
              </ButtonLink>
            )}
          </div>
        }
      />

      <Section title="What to do">
        <Markdown>{task.description}</Markdown>
      </Section>

      {task.coding && (
        <Section title="Sample tests" className="gap-4">
          <p className="text-sm text-muted">
            Languages: {task.coding.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")} · Time limit{" "}
            {task.coding.timeLimitMs / 1000} s
          </p>
          {task.coding.sampleTests.map((test, index) => (
            <div key={index} className={cardClasses({ padding: "sm", className: "flex flex-col gap-2" })}>
              <span className="font-medium">Sample {index + 1}</span>
              <Sample label="Input" text={test.input} />
              <Sample label="Expected output" text={test.output} />
            </div>
          ))}
        </Section>
      )}

      <TaskSubmitSection task={task} attemptsUsed={progress.attemptsUsed} now={now} submissions={submissions} />
      <SubmissionHistory submissions={submissions} now={now} />
    </article>
  );
}
