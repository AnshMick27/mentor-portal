import type { ReactNode } from "react";
import { AttemptList } from "@/components/student/SubmissionHistory";
import { Button } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { skillAverages } from "@/lib/dashboard/student";
import { attemptsOnOtherTasks, PROFILE_STATE_LABEL, profileTaskRows, type ProfileTaskRow } from "@/lib/dashboard/profile";
import type { StudentProfileData } from "@/lib/dashboard/profileQueries";
import { formatIst } from "@/lib/dates/ist";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";


const STATE_TONE: Record<ProfileTaskRow["state"], ChipTone> = {
  submitted: "success",
  missed: "warning",
  open: "neutral",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function TaskRow({ row, now }: { row: ProfileTaskRow; now: Date }) {
  return (
    <li>
      <Disclosure
        className={cardClasses()}
        summary={
          <span className="flex flex-col gap-0.5">
          <span className="font-semibold break-words">{row.task.title}</span>
          <span className="text-sm text-muted">
            {TASK_TYPE_LABEL[row.task.type]} · Due {formatIst(row.task.dueAt)}
          </span>
          <span className="text-sm">
            <StatusChip tone={STATE_TONE[row.state]}>{PROFILE_STATE_LABEL[row.state]}</StatusChip>
            {" · "}
            {row.attemptsUsed} of {row.task.maxAttempts} attempts
            {row.bestScore !== undefined && <> · Best {formatScore(row.bestScore)}</>}
          </span>
          </span>
        }
      >
        <div className="mt-3 border-t border-line pt-3">
          {row.attempts.length === 0 ? (
            <EmptyState>No attempts.</EmptyState>
          ) : (
            <AttemptList submissions={row.attempts} now={now} audience="mentor" />
          )}
        </div>
      </Disclosure>
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
          badge={user.removed === true ? <StatusChip tone="danger">Removed</StatusChip> : undefined}
          subtitle={
            <>
              <p>
                {user.rollNo ?? "No roll number yet"} · {user.branch ?? "—"}
              </p>
              <p className="break-all">{user.email}</p>
            </>
          }
        />
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

      <dl className={cardClasses({ className: "grid grid-cols-2 gap-4 sm:grid-cols-4" })}>
        <Stat label="Submitted" value={String(stats?.tasksSubmitted ?? 0)} />
        <Stat label="Missed" value={String(stats?.missedCount ?? 0)} />
        <Stat label="Average" value={formatScore(stats?.overallAvg)} />
        {skillAverages(stats).map((skill) => (
          <Stat key={skill.type} label={skill.label} value={formatScore(skill.average)} />
        ))}
      </dl>

      <Section title="Tasks">
        {rows.length === 0 ? (
          <EmptyState>No published tasks yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <TaskRow key={row.task.id} row={row} now={now} />
            ))}
          </ul>
        )}
        {others > 0 && (
          <p className="text-sm text-muted">
            {others} more attempt{others === 1 ? "" : "s"} on tasks that are no longer published.
          </p>
        )}
        {hasMore && (
          <Button variant="secondary" size="sm" className="self-start" onClick={onLoadMore} busy={loadingMore} busyLabel="Loading…">
            Load older attempts
          </Button>
        )}
      </Section>

      {actions && (
        <Section title="Access">
          <p className="text-sm text-muted">
            {user.removed === true
              ? "Restore this student to give them their access back."
              : "Remove this student if they are not your mentee. Their work is kept."}
          </p>
          {actions}
        </Section>
      )}
    </div>
  );
}
