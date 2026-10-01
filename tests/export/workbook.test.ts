import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  bestScores,
  buildExportWorkbook,
  exportFilename,
  SHEET_NAMES,
  taskColumnHeader,
  type ExportInput,
} from "@/lib/export/workbook";

const now = new Date("2026-10-01T06:30:00Z");

const input: ExportInput = {
  students: [
    {
      uid: "s2",
      name: "Zara Khan",
      email: "zara@college.ac.in",
      rollNo: "0827EC2",
      branch: "EC",
      stats: {
        tasksDue: 2,
        tasksSubmitted: 0,
        missedCount: 2,
        avgBySkill: {},
        needsAttention: true,
        needsAttentionReason: "Missed 2 of the last 2 tasks",
      },
    },
    {
      uid: "s1",
      name: "Asha Verma",
      email: "asha@college.ac.in",
      rollNo: "0827CS1",
      branch: "CSE",
      stats: { tasksDue: 2, tasksSubmitted: 2, missedCount: 0, avgBySkill: { coding: 10, resume: 7.5 }, overallAvg: 8.8, needsAttention: false },
    },
  ],
  tasks: [
    { id: "r1", title: "Resume review", type: "resume", dueAt: new Date("2026-09-28T18:29:00Z") },
    { id: "c1", title: "Sum of two numbers", type: "coding", dueAt: new Date("2026-09-20T18:29:00Z") },
  ],
  results: [
    { uid: "s1", taskId: "r1", type: "resume", attempt: 1, createdAt: new Date("2026-09-25T04:00:00Z"), score: 6, summary: "First draft." },
    { uid: "s1", taskId: "r1", type: "resume", attempt: 2, createdAt: new Date("2026-09-26T04:00:00Z"), score: 7.5, summary: "Much better." },
    {
      uid: "s1",
      taskId: "c1",
      type: "coding",
      attempt: 1,
      createdAt: new Date("2026-09-19T20:00:00Z"),
      score: 10,
      summary: "Accepted: all 10 tests passed.",
      judge: { passed: 10, total: 10, verdict: "Accepted" },
    },
    { uid: "ghost", taskId: "c1", type: "coding", attempt: 1, createdAt: now, score: 1, summary: "not a student" },
  ],
};

async function readBack(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer as ArrayBuffer);
  const rows = (name: string) => {
    const sheet = book.getWorksheet(name);
    if (!sheet) throw new Error(`missing sheet ${name}`);
    const out: unknown[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      out.push((row.values as unknown[]).slice(1));
    });
    return out;
  };
  return { book, rows };
}

describe("exportFilename", () => {
  it("uses the IST date (19:00 UTC is already the next day in India)", () => {
    expect(exportFilename(now)).toBe("mentor-portal-2026-10-01.xlsx");
    expect(exportFilename(new Date("2026-09-30T19:00:00Z"))).toBe("mentor-portal-2026-10-01.xlsx");
    expect(exportFilename(new Date("2026-09-30T18:00:00Z"))).toBe("mentor-portal-2026-09-30.xlsx");
  });
});

describe("bestScores", () => {
  it("keeps the best score per student and task", () => {
    expect(bestScores(input.results).get("s1|r1")).toBe(7.5);
    expect(bestScores(input.results).get("s2|r1")).toBeUndefined();
  });
});

describe("buildExportWorkbook", () => {
  it("has the three sheets in order", async () => {
    const { book } = await readBack(await buildExportWorkbook(input, now));
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual([
      SHEET_NAMES.students,
      SHEET_NAMES.taskStatus,
      SHEET_NAMES.results,
    ]);
  });

  it("Students: one row per student by name, with stats and blanks for missing averages", async () => {
    const { rows } = await readBack(await buildExportWorkbook(input, now));
    const sheet = rows(SHEET_NAMES.students);
    expect(sheet[0]).toEqual([
      "Name", "Roll no", "Branch", "Email", "Tasks due", "Submitted", "Missed",
      "Coding avg", "Resume avg", "Written intro avg", "Overall avg", "Needs attention", "Reason",
    ]);
    expect(sheet[1]).toEqual(["Asha Verma", "0827CS1", "CSE", "asha@college.ac.in", 2, 2, 0, 10, 7.5, undefined, 8.8, "No", ""]);
    expect(sheet[2]?.[0]).toBe("Zara Khan");
    expect(sheet[2]?.[11]).toBe("Yes");
    expect(sheet[2]?.[12]).toBe("Missed 2 of the last 2 tasks");
    expect(sheet).toHaveLength(3);
  });

  it("Task status: student × task matrix of best scores (tasks by due date), blank = not submitted", async () => {
    const { rows } = await readBack(await buildExportWorkbook(input, now));
    const sheet = rows(SHEET_NAMES.taskStatus);
    expect(sheet[0]).toEqual(["Name", "Roll no", "Branch", taskColumnHeader(input.tasks[1]!), taskColumnHeader(input.tasks[0]!)]);
    expect(sheet[0]?.[3]).toMatch(/^Sum of two numbers \(due 2\d Sep/);
    expect(sheet[1]).toEqual(["Asha Verma", "0827CS1", "CSE", 10, 7.5]);
    expect(sheet[2]).toEqual(["Zara Khan", "0827EC2", "EC"]); // both cells blank
  });

  it("All results: every finished attempt of known students, IST dates, verdict for coding", async () => {
    const { rows } = await readBack(await buildExportWorkbook(input, now));
    const sheet = rows(SHEET_NAMES.results);
    expect(sheet[0]).toEqual(["Name", "Roll no", "Task", "Type", "Attempt", "Submitted (IST)", "Score", "Result"]);
    expect(sheet.slice(1).map((r) => [r[2], r[4], r[6]])).toEqual([
      ["Sum of two numbers", 1, 10],
      ["Resume review", 1, 6],
      ["Resume review", 2, 7.5],
    ]);
    expect(sheet[1]?.[5]).toMatch(/^20 Sept? 2026, 1:30 am IST$/);
    expect(sheet[1]?.[7]).toBe("Passed 10/10 · Accepted");
    expect(sheet[3]?.[7]).toBe("Much better.");
    expect(JSON.stringify(sheet)).not.toContain("ghost");
  });
});
