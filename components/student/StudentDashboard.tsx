import type { ReactNode } from "react";
import Link from "next/link";
import { TextLink } from "@/components/ui/TextLink";
import { dashboardNextSteps, skillAverages } from "@/lib/dashboard/student";
import type { StudentDashboardData } from "@/lib/dashboard/studentQueries";
import { formatIst } from "@/lib/dates/ist";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { StudentTask } from "@/lib/tasks/studentBoard";
import { TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";
import { ProgressChart } from "./ProgressChart";
import { SubmissionResultView } from "./SubmissionResultView";

const CARD = "rounded-lg border border-black/10 p-4 dark:border-white/15";

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide opacity-70">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function Summary({ stats }: { stats: StudentDashboardData["stats"] }) {
  const skills = skillAverages(stats);
  return (
    <dl className={`${CARD} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
      <Stat label="Submitted" value={String(stats?.tasksSubmitted ?? 0)} />
      <Stat label="Missed" value={String(stats?.missedCount ?? 0)} />
      <Stat label="Average" value={stats?.overallAvg === undefined ? "—" : `${stats.overallAvg.toFixed(1)} / 10`} />
      {skills.map((skill) => (
        <Stat key={skill.type} label={skill.label} value={skill.average.toFixed(1)} />
      ))}
    </dl>
  );
}

function WeekTask({ task }: { task: StudentTask }) {
  const submitted = task.bestScore !== undefined;
  return (
    <li>
      <Link
        href={`/student/tasks/${task.id}`}
        className="flex flex-col gap-1 rounded-lg border border-black/10 p-4 hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/[0.05]"
      >
        <span className="font-semibold break-words">{task.title}</span>
        <span className="text-sm opacity-75">
          {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
        </span>
        <span className="text-sm">
          {submitted ? (
            <>Submitted · Best {task.bestScore?.toFixed(1)} / 10</>
          ) : task.attemptsUsed > 0 ? (
            "Being checked…"
          ) : (
            <span className="font-medium text-amber-800 dark:text-amber-300">Not submitted yet</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function LatestResult({ submission, task, open }: { submission: SubmissionView; task?: TaskDto; open: boolean }) {
  if (!submission.result) return null;
  return (
    <li>
      <details open={open} className={`${CARD} group`}>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <span className="font-semibold break-words">{task?.title ?? TASK_TYPE_LABEL[submission.type]}</span>
          <span className="text-sm opacity-75">
            {submission.result.score.toFixed(1)} / 10 · {formatIst(submission.createdAt.toISOString())}
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/15">
          <SubmissionResultView result={submission.result} />
          {task && (
            <TextLink href={`/student/tasks/${task.id}`} className="text-sm">
              Open task
            </TextLink>
          )}
        </div>
      </details>
    </li>
  );
}

/** The student home screen (SPEC.md §8.5). Presentational: the page loads the data. */
export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const taskById = new Map(data.tasks.map((task) => [task.id, task]));
  const nextSteps = dashboardNextSteps(data.stats);
  return (
    <div className="flex flex-col gap-8">
      <Summary stats={data.stats} />

      <Section title="Progress">
        <ProgressChart recentScores={data.stats?.recentScores} />
      </Section>

      <Section
        title="This week"
        action={
          <TextLink href="/student/tasks" className="text-sm">
            All tasks
          </TextLink>
        }
      >
        {data.week.length === 0 ? (
          <p className="text-sm opacity-70">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.week.map((task) => (
              <WeekTask key={task.id} task={task} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Latest feedback">
        {data.latest.length === 0 ? (
          <p className="text-sm opacity-70">No feedback yet. Submit a task to get your first score.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.latest.map((submission, index) => (
              <LatestResult
                key={submission.id}
                submission={submission}
                task={taskById.get(submission.taskId)}
                open={index === 0}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Next steps">
        {nextSteps.length === 0 ? (
          <p className="text-sm opacity-70">Your next steps appear here after your first resume or intro feedback.</p>
        ) : (
          <ol className={`${CARD} list-decimal space-y-2 pl-9`}>
            {nextSteps.map((step, index) => (
              <li key={index} className="break-words">
                {step}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
