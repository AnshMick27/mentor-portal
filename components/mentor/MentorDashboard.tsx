"use client";

import { useState } from "react";
import { cardClasses } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClasses } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { Stat } from "@/components/ui/Stat";
import { TaskTypeTag } from "@/components/ui/TaskTypeTag";
import { TextLink } from "@/components/ui/TextLink";
import {
  branchesOf,
  classSkillAverages,
  needsAttentionList,
  taskStatusRows,
  type BranchFilter,
  type StudentRef,
  type TaskStatusRow,
} from "@/lib/dashboard/mentor";
import type { MentorDashboardData } from "@/lib/dashboard/mentorQueries";
import { formatIst } from "@/lib/dates/ist";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";


const score = (value: number | undefined) => (value === undefined ? "—" : value.toFixed(1));

function StudentLink({ student }: { student: StudentRef }) {
  return (
    <TextLink href={`/mentor/students/${student.uid}`}>{student.name}</TextLink>
  );
}

function TaskStatus({ row }: { row: TaskStatusRow }) {
  return (
    <li className={cardClasses({ padding: "none", className: "flex flex-col gap-3 p-4 sm:p-6" })}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold break-words">{row.task.title}</span>
          <span className="text-sm text-muted">
            {TASK_TYPE_LABEL[row.task.type]} · Due {formatIst(row.task.dueAt)}
          </span>
        </div>
        <TaskTypeTag type={row.task.type} />
      </div>
      {row.hasStats ? (
        <>
          <p className="text-sm">
            <span className="font-semibold">{row.submitted}</span> of {row.total} submitted · Average {formatScore(row.average)}
          </p>
          <ProgressBar value={row.submitted} max={row.total} />
          {row.notSubmitted.length > 0 ? (
            <Disclosure summary={`${row.notSubmitted.length} not submitted`} summaryClassName="text-sm font-medium">
              <ul className="flex flex-col pl-1 text-sm">
                {row.notSubmitted.map((student) => (
                  <li key={student.uid} className="flex min-h-11 flex-wrap items-center gap-x-2 break-words">
                    <StudentLink student={student} /> <span className="text-muted">{student.rollNo}</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : (
            <EmptyState>Everyone has submitted.</EmptyState>
          )}
        </>
      ) : (
        <EmptyState>No numbers yet. They appear after the first submission, or after tonight&apos;s update.</EmptyState>
      )}
      <TextLink href={`/mentor/tasks/${row.task.id}/submissions`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm">
        See who submitted <span aria-hidden="true">→</span>
      </TextLink>
    </li>
  );
}

/** The mentor/viewer dashboard (SPEC.md §8.6), filtered by branch. Presentational apart from the filter. */
export function MentorDashboardView({
  data,
  branch,
  onBranch,
}: {
  data: MentorDashboardData;
  branch: BranchFilter;
  onBranch: (branch: BranchFilter) => void;
}) {
  const rows = taskStatusRows(data.tasks, data.taskStats, data.students, branch);
  const attention = needsAttentionList(data.students, branch);
  const skills = classSkillAverages(data.students, branch);
  const branches = branchesOf(data.students);
  return (
    <div className="flex flex-col gap-8">
      <PendingNote count={data.pendingCount ?? 0} />
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

      <Section title="Task status">
        {rows.length === 0 ? (
          <EmptyState>No published tasks yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <TaskStatus key={row.task.id} row={row} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Needs attention (${attention.length})`}>
        {attention.length === 0 ? (
          <EmptyState>Nobody is flagged right now.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((student) => (
              <li key={student.uid} className={cardClasses({ className: "flex flex-col gap-0.5 text-sm" })}>
                <span className="break-words">
                  <StudentLink student={student} />{" "}
                  <span className="text-muted">
                    {student.rollNo} · {student.branch}
                  </span>
                </span>
                <span>{student.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Class overview">
        <dl
          className={cardClasses({
            padding: "none",
            className: "grid grid-cols-1 divide-y divide-line p-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:p-6",
          })}
        >
          {skills.map((skill) => (
            <div key={skill.type} className="py-3 first:pt-0 last:pb-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0">
              <Stat
                label={skill.label}
                value={formatScore(skill.average)}
                hint={`${skill.students} student${skill.students === 1 ? "" : "s"} with a score`}
              />
            </div>
          ))}
        </dl>
        {rows.length > 0 && (
          <div className={cardClasses({ padding: "none", className: "p-4 sm:p-6" })}>
          <table className="w-full border-collapse text-left text-sm">
            <caption className="mb-3 text-left font-semibold">Average per task</caption>
            <thead>
              <tr className="bg-surface">
                <th scope="col" className="rounded-l-md px-3 py-2 font-medium">
                  Task
                </th>
                <th scope="col" className="w-20 rounded-r-md px-3 py-2 text-right font-medium">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.task.id} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-3 break-words">
                    <TextLink href={`/mentor/tasks/${row.task.id}/submissions`}>{row.task.title}</TextLink>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{score(row.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/** New students waiting for approval (T48), linked to the Students page where they are approved. */
export function PendingNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Note tone="info" title={count === 1 ? "1 new student is waiting for approval" : `${count} new students are waiting for approval`}>
      <p>
        They cannot see any tasks until they are approved. <TextLink href="/mentor/students">Review them on the Students page</TextLink>
      </p>
    </Note>
  );
}

export function MentorDashboard({ data }: { data: MentorDashboardData }) {
  const [branch, setBranch] = useState<BranchFilter>("all");
  return <MentorDashboardView data={data} branch={branch} onBranch={setBranch} />;
}
