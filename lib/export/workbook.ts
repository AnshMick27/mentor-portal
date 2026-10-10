import "server-only";
import ExcelJS from "exceljs";
import { formatIst, formatIstShortDate, toIstInputValue } from "@/lib/dates/ist";
import { verdictLabel } from "@/lib/submissions/judgeDisplay";
import type { JudgeResult } from "@/lib/validation/submission";
import { TASK_TYPE_LABEL, type TaskType } from "@/lib/validation/task";
import type { Branch } from "@/lib/validation/user";

/** What the export needs; built from Firestore by lib/export/load.ts. No submission content, ever. */
export type ExportStudent = {
  uid: string;
  name: string;
  email: string;
  rollNo: string;
  branch: Branch | "";
  stats?: {
    tasksDue: number;
    tasksSubmitted: number;
    missedCount: number;
    avgBySkill: Partial<Record<TaskType, number>>;
    overallAvg?: number;
    needsAttention: boolean;
    needsAttentionReason?: string;
  };
};
export type ExportTask = { id: string; title: string; type: TaskType; dueAt: Date };
export type ExportResult = {
  uid: string;
  taskId: string;
  type: TaskType;
  attempt: number;
  createdAt: Date;
  score: number;
  summary: string;
  judge?: JudgeResult;
};
export type ExportInput = { students: ExportStudent[]; tasks: ExportTask[]; results: ExportResult[] };

export const SHEET_NAMES = { students: "Students", taskStatus: "Task status", results: "All results" } as const;

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** `mentor-portal-YYYY-MM-DD.xlsx`, dated in IST. */
export function exportFilename(now: Date): string {
  return `mentor-portal-${toIstInputValue(now.toISOString()).slice(0, 10)}.xlsx`;
}

const byName = (a: ExportStudent, b: ExportStudent) => a.name.localeCompare(b.name) || a.rollNo.localeCompare(b.rollNo);
const blankIfMissing = (value: number | undefined) => (value === undefined ? null : value);

/** Best score per `uid|taskId` from finished results (SPEC.md §6 scoring rule). */
export function bestScores(results: readonly ExportResult[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const result of results) {
    const key = `${result.uid}|${result.taskId}`;
    const current = best.get(key);
    if (current === undefined || result.score > current) best.set(key, result.score);
  }
  return best;
}

/** Bold, frozen header row so the sheet stays readable when scrolled. */
function styleHeader(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addStudentsSheet(book: ExcelJS.Workbook, students: ExportStudent[]): void {
  const sheet = book.addWorksheet(SHEET_NAMES.students);
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Roll no", key: "rollNo", width: 16 },
    { header: "Branch", key: "branch", width: 10 },
    { header: "Email", key: "email", width: 30 },
    { header: "Tasks due", key: "tasksDue", width: 10 },
    { header: "Submitted", key: "tasksSubmitted", width: 10 },
    { header: "Missed", key: "missedCount", width: 8 },
    { header: "Coding avg", key: "coding", width: 11 },
    { header: "Resume avg", key: "resume", width: 11 },
    { header: "Written intro avg", key: "intro_written", width: 16 },
    { header: "Scenario avg", key: "scenario", width: 12 },
    { header: "Overall avg", key: "overallAvg", width: 11 },
    { header: "Needs attention", key: "needsAttention", width: 15 },
    { header: "Reason", key: "reason", width: 36 },
  ];
  for (const student of students) {
    const stats = student.stats;
    sheet.addRow({
      name: student.name,
      rollNo: student.rollNo,
      branch: student.branch,
      email: student.email,
      tasksDue: stats?.tasksDue ?? 0,
      tasksSubmitted: stats?.tasksSubmitted ?? 0,
      missedCount: stats?.missedCount ?? 0,
      coding: blankIfMissing(stats?.avgBySkill.coding),
      resume: blankIfMissing(stats?.avgBySkill.resume),
      intro_written: blankIfMissing(stats?.avgBySkill.intro_written),
      scenario: blankIfMissing(stats?.avgBySkill.scenario),
      overallAvg: blankIfMissing(stats?.overallAvg),
      needsAttention: stats?.needsAttention ? "Yes" : "No",
      reason: stats?.needsAttentionReason ?? "",
    });
  }
  styleHeader(sheet);
}

/** Header for a task column: title plus IST due day, so two tasks with the same title stay distinct. */
export function taskColumnHeader(task: ExportTask): string {
  return `${task.title} (due ${formatIstShortDate(task.dueAt.getTime())})`;
}

function addTaskStatusSheet(book: ExcelJS.Workbook, students: ExportStudent[], tasks: ExportTask[], best: Map<string, number>) {
  const sheet = book.addWorksheet(SHEET_NAMES.taskStatus);
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Roll no", key: "rollNo", width: 16 },
    { header: "Branch", key: "branch", width: 10 },
    ...tasks.map((task) => ({ header: taskColumnHeader(task), key: `task:${task.id}`, width: 18 })),
  ];
  for (const student of students) {
    const row: Record<string, string | number | null> = {
      name: student.name,
      rollNo: student.rollNo,
      branch: student.branch,
    };
    // Blank cell = not submitted (no finished attempt).
    for (const task of tasks) row[`task:${task.id}`] = best.get(`${student.uid}|${task.id}`) ?? null;
    sheet.addRow(row);
  }
  styleHeader(sheet);
}

function resultText(result: ExportResult): string {
  return result.judge ? `Passed ${result.judge.passed}/${result.judge.total} · ${verdictLabel(result.judge)}` : result.summary;
}

function addResultsSheet(book: ExcelJS.Workbook, input: ExportInput, students: ExportStudent[]): void {
  const sheet = book.addWorksheet(SHEET_NAMES.results);
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Roll no", key: "rollNo", width: 16 },
    { header: "Task", key: "task", width: 28 },
    { header: "Type", key: "type", width: 13 },
    { header: "Attempt", key: "attempt", width: 8 },
    { header: "Submitted (IST)", key: "submitted", width: 26 },
    { header: "Score", key: "score", width: 7 },
    { header: "Result", key: "result", width: 60 },
  ];
  const studentByUid = new Map(students.map((student) => [student.uid, student]));
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const rows = input.results
    .filter((result) => studentByUid.has(result.uid))
    .sort((a, b) => {
      const sa = studentByUid.get(a.uid);
      const sb = studentByUid.get(b.uid);
      return (sa && sb ? byName(sa, sb) : 0) || a.createdAt.getTime() - b.createdAt.getTime();
    });
  for (const result of rows) {
    const student = studentByUid.get(result.uid);
    sheet.addRow({
      name: student?.name ?? "",
      rollNo: student?.rollNo ?? "",
      task: taskById.get(result.taskId)?.title ?? "(unpublished task)",
      type: TASK_TYPE_LABEL[result.type],
      attempt: result.attempt,
      submitted: formatIst(result.createdAt.toISOString()),
      score: result.score,
      result: resultText(result),
    });
  }
  styleHeader(sheet);
}

/** SPEC.md §8.6 export: three sheets, students by name, published tasks by due date. Returns xlsx bytes. */
export async function buildExportWorkbook(input: ExportInput, now: Date): Promise<Uint8Array<ArrayBuffer>> {
  const book = new ExcelJS.Workbook();
  book.creator = "CDC Mentor Portal";
  book.created = now;
  const students = [...input.students].sort(byName);
  const tasks = [...input.tasks].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  addStudentsSheet(book, students);
  addTaskStatusSheet(book, students, tasks, bestScores(input.results));
  addResultsSheet(book, input, students);
  // Copy into a plain ArrayBuffer-backed array, which `new Response(...)` accepts as a body.
  const written = new Uint8Array(await book.xlsx.writeBuffer());
  const bytes = new Uint8Array(new ArrayBuffer(written.byteLength));
  bytes.set(written);
  return bytes;
}
