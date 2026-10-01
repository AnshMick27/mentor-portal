import { Markdown } from "@/components/Markdown";
import { SubmissionHistory } from "@/components/student/SubmissionHistory";
import { TaskSubmitSection } from "@/components/student/TaskSubmitSection";
import { cardClasses } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { formatIst } from "@/lib/dates/ist";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { taskProgress } from "@/lib/tasks/studentBoard";
import { LANGUAGE_LABEL, TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";

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
  const { attemptsUsed, bestScore } = taskProgress(submissions, now);
  const pastDue = Date.parse(task.dueAt) < now.getTime();
  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        back={{ href: "/student/tasks", label: "My tasks" }}
        subtitle={
          <>
            <p>
              {TASK_TYPE_LABEL[task.type]} · {pastDue ? "Was due" : "Due"} {formatIst(task.dueAt)}
            </p>
            <p>
              Attempts: {attemptsUsed} of {task.maxAttempts} used
              {bestScore !== undefined && <> · Best score {bestScore.toFixed(1)} / 10</>}
            </p>
          </>
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

      <TaskSubmitSection task={task} attemptsUsed={attemptsUsed} now={now} />
      <SubmissionHistory submissions={submissions} now={now} />
    </article>
  );
}
