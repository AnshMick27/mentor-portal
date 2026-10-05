"use client";

import { cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClasses } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { StatusChip } from "@/components/ui/StatusChip";
import { IntegrityCheck } from "./IntegrityCheck";
import { TaskTypeTag } from "@/components/ui/TaskTypeTag";
import { TextLink } from "@/components/ui/TextLink";
import { branchesOf, type BranchFilter } from "@/lib/dashboard/mentor";
import { formatIst } from "@/lib/dates/ist";
import type { TaskRosterData } from "@/lib/tasks/rosterQuery";
import { buildTaskRoster, type RosterStudent } from "@/lib/tasks/submissionRoster";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";

function Who({ student }: { student: RosterStudent }) {
  return (
    <span className="flex flex-col gap-0.5">
      <TextLink href={`/mentor/students/${student.uid}`} strong className="tracking-wide uppercase">
        {student.name}
      </TextLink>
      <span className="text-muted">
        {student.rollNo} · {student.branch}
      </span>
    </span>
  );
}

/** Mentor/viewer: who has and has not submitted one task, filtered by branch. Presentational apart from the filter. */
export function TaskSubmissionsView({
  data,
  branch,
  onBranch,
  now,
}: {
  data: TaskRosterData;
  branch: BranchFilter;
  onBranch: (branch: BranchFilter) => void;
  now: Date;
}) {
  const roster = buildTaskRoster(data.students, data.submissions, branch, now);
  const branches = branchesOf(data.students);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <TaskTypeTag type={data.task.type} />
          <span>
            {TASK_TYPE_LABEL[data.task.type]} · Due {formatIst(data.task.dueAt)}
          </span>
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1 text-sm font-medium sm:flex-row sm:items-center sm:gap-3">
          Branch
          <select
            value={branch}
            onChange={(event) => onBranch(event.target.value as BranchFilter)}
            className={`${inputClasses} font-normal sm:w-auto`}
          >
            <option value="all">All branches ({data.students.length} students)</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <div className={cardClasses({ className: "flex flex-col gap-2 sm:min-w-64" })}>
          <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Submissions</span>
          <p className="text-lg">
            <span className="font-semibold">{roster.submitted.length}</span> of {roster.total} submitted
          </p>
          <ProgressBar value={roster.submitted.length} max={roster.total} />
        </div>
        </div>
      </div>

      <Section title="Not submitted" count={roster.notSubmitted.length}>
        {roster.notSubmitted.length === 0 ? (
          <EmptyState>{roster.total === 0 ? "No students yet." : "Everyone has submitted."}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.notSubmitted.map(({ student, checking, lateOnly, flags }) => (
              <li
                key={student.uid}
                className={cardClasses({ className: "flex flex-wrap items-center justify-between gap-2 text-sm" })}
              >
                <Who student={student} />
                {(checking || lateOnly) && (
                  <span className="flex flex-wrap gap-2">
                    {checking && <StatusChip tone="info">Being checked</StatusChip>}
                    {/* Late work gets feedback but does not count (T44), so they stay under "Not submitted". */}
                    {lateOnly && <StatusChip tone="warning">Sent late</StatusChip>}
                  </span>
                )}
                <IntegrityCheck flags={flags} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Submitted" count={roster.submitted.length}>
        {roster.submitted.length === 0 ? (
          <EmptyState>Nobody has submitted yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.submitted.map(({ student, best, attempts, lastAt, flags }) => (
              <li
                key={student.uid}
                className={cardClasses({ className: "flex flex-wrap items-start justify-between gap-2 text-sm" })}
              >
                <span className="flex flex-col gap-1">
                  <Who student={student} />
                  <IntegrityCheck flags={flags} />
                </span>
                <span className="flex flex-col gap-0.5 sm:items-end">
                  <span className="font-semibold">Best {formatScore(best)}</span>
                  <span className="text-muted">
                    {attempts} attempt{attempts === 1 ? "" : "s"} · Last {formatIst(lastAt.toISOString())}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
