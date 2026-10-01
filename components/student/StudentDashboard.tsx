import { cardClasses, CardLink } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextLink } from "@/components/ui/TextLink";
import { dashboardNextSteps, skillAverages } from "@/lib/dashboard/student";
import type { StudentDashboardData } from "@/lib/dashboard/studentQueries";
import { formatIst } from "@/lib/dates/ist";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { StudentTask } from "@/lib/tasks/studentBoard";
import { TASK_TYPE_LABEL, type TaskDto } from "@/lib/validation/task";
import { ProgressChart } from "./ProgressChart";
import { SubmissionResultView } from "./SubmissionResultView";

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
    <dl className={cardClasses({ className: "grid grid-cols-2 gap-4 sm:grid-cols-4" })}>
      <Stat label="Submitted" value={String(stats?.tasksSubmitted ?? 0)} />
      <Stat label="Missed" value={String(stats?.missedCount ?? 0)} />
      <Stat label="Average" value={formatScore(stats?.overallAvg)} />
      {skills.map((skill) => (
        <Stat key={skill.type} label={skill.label} value={formatScore(skill.average)} />
      ))}
    </dl>
  );
}

function WeekTask({ task }: { task: StudentTask }) {
  const submitted = task.bestScore !== undefined;
  return (
    <li>
      <CardLink href={`/student/tasks/${task.id}`}>
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
            <StatusChip tone="warning">Not submitted yet</StatusChip>
          )}
        </span>
      </CardLink>
    </li>
  );
}

function LatestResult({ submission, task, open }: { submission: SubmissionView; task?: TaskDto; open: boolean }) {
  if (!submission.result) return null;
  return (
    <li>
      <Disclosure
        defaultOpen={open}
        className={cardClasses()}
        summary={
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-semibold break-words">{task?.title ?? TASK_TYPE_LABEL[submission.type]}</span>
            <span className="text-sm text-muted">
              {formatScore(submission.result.score)} · {formatIst(submission.createdAt.toISOString())}
            </span>
          </span>
        }
      >
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <SubmissionResultView result={submission.result} />
          {task && (
            <TextLink href={`/student/tasks/${task.id}`} className="text-sm">
              Open task
            </TextLink>
          )}
        </div>
      </Disclosure>
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
          <EmptyState>Nothing due in the next 7 days.</EmptyState>
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
          <EmptyState>No feedback yet. Submit a task to get your first score.</EmptyState>
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
          <EmptyState>Your next steps appear here after your first resume or intro feedback.</EmptyState>
        ) : (
          <ol className={cardClasses({ className: "list-decimal space-y-2 pl-9" })}>
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
