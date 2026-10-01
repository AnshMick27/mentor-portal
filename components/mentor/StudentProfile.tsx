import type { ReactNode } from "react";
import { AttemptList } from "@/components/student/SubmissionHistory";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { PageHeader } from "@/components/ui/PageHeader";
import { skillAverages } from "@/lib/dashboard/student";
import { attemptsOnOtherTasks, PROFILE_STATE_LABEL, profileTaskRows, type ProfileTaskRow } from "@/lib/dashboard/profile";
import type { StudentProfileData } from "@/lib/dashboard/profileQueries";
import { formatIst } from "@/lib/dates/ist";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";

const CARD = "rounded-lg border border-black/10 p-4 dark:border-white/15";

const STATE_CLASS: Record<ProfileTaskRow["state"], string> = {
  submitted: "text-green-800 dark:text-green-300",
  missed: "text-amber-800 dark:text-amber-300",
  open: "opacity-70",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide opacity-70">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function TaskRow({ row, now }: { row: ProfileTaskRow; now: Date }) {
  return (
    <li>
      <details className={CARD}>
        <summary className="flex min-h-11 cursor-pointer flex-col gap-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <span className="font-semibold break-words">{row.task.title}</span>
          <span className="text-sm opacity-75">
            {TASK_TYPE_LABEL[row.task.type]} · Due {formatIst(row.task.dueAt)}
          </span>
          <span className="text-sm">
            <span className={`font-medium ${STATE_CLASS[row.state]}`}>{PROFILE_STATE_LABEL[row.state]}</span>
            {" · "}
            {row.attemptsUsed} of {row.task.maxAttempts} attempts
            {row.bestScore !== undefined && <> · Best {row.bestScore.toFixed(1)} / 10</>}
          </span>
        </summary>
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/15">
          {row.attempts.length === 0 ? (
            <p className="text-sm opacity-70">No attempts.</p>
          ) : (
            <AttemptList submissions={row.attempts} now={now} audience="mentor" />
          )}
        </div>
      </details>
    </li>
  );
}

/** A mentor's/viewer's read-only view of one student (SPEC.md §8.6): stats, every task, every attempt. */
export function StudentProfile({
  data,
  submissions,
  now,
  hasMore,
  loadingMore,
  onLoadMore,
  actions,
}: {
  data: StudentProfileData;
  submissions: readonly SubmissionView[];
  now: Date;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Mentor-only controls (Remove / Restore), shown under the student's details. */
  actions?: ReactNode;
}) {
  const { user, stats } = data;
  const rows = profileTaskRows(data.tasks, submissions, now);
  const others = attemptsOnOtherTasks(data.tasks, submissions);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <PageHeader
          title={user.name}
          back={{ href: "/mentor/students", label: "Students" }}
          subtitle={`${user.rollNo ?? "No roll number yet"} · ${user.branch ?? "—"} · ${user.email}`}
        />
        {actions}
      </div>

      {user.removed === true && (
        <Note tone="neutral">
          Removed from the portal: this student cannot sign in and is left out of dashboards and the export. Their work
          below is kept.
        </Note>
      )}

      {stats?.needsAttention && (
        <Note tone="warning">Needs attention: {stats.needsAttentionReason ?? "flagged"}</Note>
      )}

      <dl className={`${CARD} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
        <Stat label="Submitted" value={String(stats?.tasksSubmitted ?? 0)} />
        <Stat label="Missed" value={String(stats?.missedCount ?? 0)} />
        <Stat label="Average" value={stats?.overallAvg === undefined ? "—" : `${stats.overallAvg.toFixed(1)} / 10`} />
        {skillAverages(stats).map((skill) => (
          <Stat key={skill.type} label={skill.label} value={skill.average.toFixed(1)} />
        ))}
      </dl>

      <section className="flex flex-col gap-3" aria-label="Tasks">
        <h2 className="text-lg font-semibold">Tasks</h2>
        {rows.length === 0 ? (
          <p className="text-sm opacity-70">No published tasks yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <TaskRow key={row.task.id} row={row} now={now} />
            ))}
          </ul>
        )}
        {others > 0 && (
          <p className="text-sm opacity-70">
            {others} more attempt{others === 1 ? "" : "s"} on tasks that are no longer published.
          </p>
        )}
        {hasMore && (
          <Button variant="secondary" size="sm" className="self-start" onClick={onLoadMore} busy={loadingMore} busyLabel="Loading…">
            Load older attempts
          </Button>
        )}
      </section>
    </div>
  );
}
