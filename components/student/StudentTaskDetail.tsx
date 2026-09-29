import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { TaskSubmitSection } from "@/components/student/TaskSubmitSection";
import { formatIst } from "@/lib/dates/ist";
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
  attemptsUsed,
  now,
  onSubmitted = () => undefined,
}: {
  task: TaskDto;
  attemptsUsed: number;
  now: Date;
  onSubmitted?: () => void;
}) {
  const pastDue = Date.parse(task.dueAt) < now.getTime();
  return (
    <article className="flex flex-col gap-6">
      <Link href="/student/tasks" className="self-start text-sm font-medium text-blue-700 underline dark:text-blue-300">
        ← All tasks
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight break-words">{task.title}</h1>
        <p className="text-sm opacity-80">
          {TASK_TYPE_LABEL[task.type]} · {pastDue ? "Was due" : "Due"} {formatIst(task.dueAt)}
        </p>
        <p className="text-sm opacity-80">
          Attempts: {attemptsUsed} of {task.maxAttempts} used
        </p>
      </header>

      <Markdown>{task.description}</Markdown>

      {task.coding && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Sample tests</h2>
          <p className="text-sm opacity-80">
            Languages: {task.coding.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")} · Time limit{" "}
            {task.coding.timeLimitMs / 1000} s
          </p>
          {task.coding.sampleTests.map((test, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
              <span className="font-medium">Sample {index + 1}</span>
              <Sample label="Input" text={test.input} />
              <Sample label="Expected output" text={test.output} />
            </div>
          ))}
        </section>
      )}

      <TaskSubmitSection task={task} attemptsUsed={attemptsUsed} now={now} onSubmitted={onSubmitted} />
    </article>
  );
}
