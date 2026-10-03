import type { BranchFilter } from "@/lib/dashboard/mentor";
import { countsForScore, effectiveStatus } from "@/lib/submissions/scoring";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { StudentRow } from "@/lib/students/list";
import type { Branch } from "@/lib/validation/user";

/** An onboarded, not-removed student: the only ones a task's roster counts (same as the stats). */
export type RosterStudent = StudentRow & { rollNo: string; branch: Branch };

export type SubmittedRow = {
  student: RosterStudent;
  /** Best score over finished attempts. */
  best: number;
  /** Attempts that count (failed "not counted" ones left out). */
  attempts: number;
  lastAt: Date;
};

export type NotSubmittedRow = {
  student: RosterStudent;
  /** An attempt is still being checked (queued/running, under 10 minutes old). */
  checking: boolean;
  /** Sent only late work (T44): feedback, but it does not count as submitted. */
  lateOnly: boolean;
};

export type TaskRoster = { total: number; submitted: SubmittedRow[]; notSubmitted: NotSubmittedRow[] };

export function rosterStudents(rows: readonly StudentRow[]): RosterStudent[] {
  return rows.flatMap((row) =>
    row.onboarded && !row.removed && row.rollNo && row.branch ? [{ ...row, rollNo: row.rollNo, branch: row.branch }] : [],
  );
}

const byName = (a: { student: RosterStudent }, b: { student: RosterStudent }) =>
  a.student.name.localeCompare(b.student.name) || a.student.rollNo.localeCompare(b.student.rollNo);

/**
 * Who has and has not submitted one task. "Submitted" = at least one counted attempt (finished, scored, on time:
 * `countsForScore`), the same rule as `taskStats`, but read live from the task's submissions so it never waits for a recompute.
 */
export function buildTaskRoster(
  students: readonly RosterStudent[],
  submissions: readonly SubmissionView[],
  branch: BranchFilter,
  now: Date,
): TaskRoster {
  const counted = branch === "all" ? students : students.filter((student) => student.branch === branch);
  const byUid = new Map<string, SubmissionView[]>();
  for (const submission of submissions) byUid.set(submission.uid, [...(byUid.get(submission.uid) ?? []), submission]);

  const submitted: SubmittedRow[] = [];
  const notSubmitted: NotSubmittedRow[] = [];
  for (const student of counted) {
    const own = (byUid.get(student.uid) ?? []).map((submission) => ({
      submission,
      status: effectiveStatus(submission, now).status,
    }));
    const scores = own.flatMap(({ submission, status }) => {
      const effective = { ...submission, status };
      return countsForScore(effective) ? [effective.result.score] : [];
    });
    const counting = own.filter(({ status }) => status !== "error");
    if (scores.length > 0) {
      submitted.push({
        student,
        best: Math.max(...scores),
        attempts: counting.length,
        lastAt: new Date(Math.max(...counting.map(({ submission }) => submission.createdAt.getTime()))),
      });
    } else {
      notSubmitted.push({
        student,
        checking: own.some(({ status }) => status === "queued" || status === "running"),
        lateOnly: own.some(({ submission, status }) => submission.late === true && status !== "error"),
      });
    }
  }
  return { total: counted.length, submitted: submitted.sort(byName), notSubmitted: notSubmitted.sort(byName) };
}
