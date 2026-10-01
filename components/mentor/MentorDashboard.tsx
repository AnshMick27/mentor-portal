"use client";

import { useState } from "react";
import { cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
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
    <li className={cardClasses({ className: "flex flex-col gap-2" })}>
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold break-words">{row.task.title}</span>
        <span className="text-sm opacity-75">
          {TASK_TYPE_LABEL[row.task.type]} · Due {formatIst(row.task.dueAt)}
        </span>
      </div>
      {row.hasStats ? (
        <>
          <p className="text-sm">
            <span className="font-semibold">{row.submitted}</span> of {row.total} submitted · Average {score(row.average)}
          </p>
          {row.notSubmitted.length > 0 ? (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                {row.notSubmitted.length} not submitted
              </summary>
              <ul className="flex flex-col gap-1 pl-1 text-sm">
                {row.notSubmitted.map((student) => (
                  <li key={student.uid} className="break-words">
                    <StudentLink student={student} /> <span className="opacity-70">{student.rollNo}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <EmptyState>Everyone has submitted.</EmptyState>
          )}
        </>
      ) : (
        <EmptyState>No numbers yet: they appear after the first submission or tonight&apos;s update.</EmptyState>
      )}
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
      <label className="flex flex-col gap-1 text-sm font-medium sm:flex-row sm:items-center sm:gap-3">
        Branch
        <select
          value={branch}
          onChange={(event) => onBranch(event.target.value as BranchFilter)}
          className="min-h-11 rounded-lg border border-black/20 bg-transparent px-3 text-base dark:border-white/25"
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
                  <span className="opacity-70">
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
        <dl className={cardClasses({ className: "grid grid-cols-1 gap-3 sm:grid-cols-3" })}>
          {skills.map((skill) => (
            <div key={skill.type} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide opacity-70">{skill.label}</dt>
              <dd className="text-xl font-bold">{score(skill.average)}</dd>
              <dd className="text-xs opacity-70">
                {skill.students} student{skill.students === 1 ? "" : "s"} with a score
              </dd>
            </div>
          ))}
        </dl>
        {rows.length > 0 && (
          <table className="w-full border-collapse text-left text-sm">
            <caption className="mb-1 text-left font-semibold">Average per task</caption>
            <thead>
              <tr className="border-b border-black/15 dark:border-white/20">
                <th scope="col" className="py-2 pr-2 font-medium">
                  Task
                </th>
                <th scope="col" className="w-20 py-2 text-right font-medium">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.task.id} className="border-b border-black/10 dark:border-white/10">
                  <td className="py-2 pr-2 break-words">{row.task.title}</td>
                  <td className="py-2 text-right tabular-nums">{score(row.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

export function MentorDashboard({ data }: { data: MentorDashboardData }) {
  const [branch, setBranch] = useState<BranchFilter>("all");
  return <MentorDashboardView data={data} branch={branch} onBranch={setBranch} />;
}
