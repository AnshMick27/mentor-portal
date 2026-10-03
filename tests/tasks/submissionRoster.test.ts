import { describe, expect, it } from "vitest";
import type { StudentRow } from "@/lib/students/list";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { buildTaskRoster, rosterStudents } from "@/lib/tasks/submissionRoster";

const now = new Date("2026-10-03T10:00:00Z");
const row = (uid: string, name: string, extra: Partial<StudentRow> = {}): StudentRow => ({
  uid,
  name,
  email: `${uid}@acropolis.in`,
  rollNo: `R-${uid}`,
  branch: "CSIT",
  onboarded: true,
  removed: false,
  ...extra,
});
const sub = (uid: string, extra: Partial<SubmissionView> = {}): SubmissionView => ({
  id: `${uid}-${Math.random()}`,
  taskId: "t1",
  uid,
  type: "intro_written",
  attempt: 1,
  createdAt: new Date("2026-10-02T10:00:00Z"),
  status: "done",
  content: "",
  result: { score: 6, summary: "", strengths: [], improvements: [], nextSteps: [] },
  ...extra,
});

describe("rosterStudents", () => {
  it("keeps only onboarded, not-removed students", () => {
    const kept = rosterStudents([
      row("a", "Asha"),
      row("b", "Bina", { onboarded: false, rollNo: undefined, branch: undefined }),
      row("c", "Chirag", { removed: true }),
    ]);
    expect(kept.map((s) => s.uid)).toEqual(["a"]);
  });
});

describe("buildTaskRoster", () => {
  const students = rosterStudents([
    row("a", "Asha"),
    row("b", "Bina", { branch: "IT" }),
    row("c", "Chirag"),
    row("d", "Dev"),
  ]);

  it("splits students into submitted (best score, counted attempts, last time) and not submitted", () => {
    const roster = buildTaskRoster(
      students,
      [
        sub("a", { attempt: 1, result: { score: 4, summary: "", strengths: [], improvements: [], nextSteps: [] } }),
        sub("a", { attempt: 2, createdAt: new Date("2026-10-02T12:00:00Z") }),
        sub("a", { attempt: 3, status: "error", result: undefined, createdAt: new Date("2026-10-02T13:00:00Z") }),
        sub("b", { status: "queued", result: undefined, createdAt: new Date("2026-10-03T09:58:00Z") }),
        sub("c", { status: "error", result: undefined }),
        sub("zzz"), // a removed or unknown student: ignored
      ],
      "all",
      now,
    );
    expect(roster.total).toBe(4);
    expect(roster.submitted).toEqual([
      expect.objectContaining({ best: 6, attempts: 2, lastAt: new Date("2026-10-02T12:00:00Z") }),
    ]);
    expect(roster.submitted[0]?.student.uid).toBe("a");
    expect(roster.notSubmitted.map((r) => [r.student.uid, r.checking])).toEqual([
      ["b", true],
      ["c", false],
      ["d", false],
    ]);
  });

  it("treats an attempt stuck for more than 10 minutes as not being checked", () => {
    const roster = buildTaskRoster(students, [sub("b", { status: "queued", result: undefined })], "all", now);
    expect(roster.notSubmitted.find((r) => r.student.uid === "b")?.checking).toBe(false);
  });

  it("filters by branch", () => {
    const roster = buildTaskRoster(students, [sub("a")], "IT", now);
    expect(roster.total).toBe(1);
    expect(roster.submitted).toEqual([]);
    expect(roster.notSubmitted.map((r) => r.student.uid)).toEqual(["b"]);
  });
});
