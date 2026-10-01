import { describe, expect, it } from "vitest";
import { progressText, taskChip } from "@/components/student/taskStatus";
import { dueText } from "@/components/ui/dueText";
import { formatScore } from "@/components/ui/Score";
import type { StudentTask } from "@/lib/tasks/studentBoard";

// Due 5 Oct 2026, 11:59 pm IST = 18:29 UTC.
const DUE = "2026-10-05T18:29:00.000Z";

describe("dueText (IST calendar days)", () => {
  it.each([
    // [now (UTC), expected]
    ["2026-10-05T18:00:00Z", "Due today (5 Oct 2026, 11:59 pm IST)"], // 11:30 pm IST same day
    ["2026-10-04T18:30:00Z", "Due today (5 Oct 2026, 11:59 pm IST)"], // exactly IST midnight starting the 5th
    ["2026-10-04T18:29:00Z", "Due tomorrow (5 Oct 2026, 11:59 pm IST)"], // 11:59 pm IST on the 4th
    ["2026-10-04T00:00:00Z", "Due tomorrow (5 Oct 2026, 11:59 pm IST)"], // 5:30 am IST on the 4th
    ["2026-10-03T20:00:00Z", "Due tomorrow (5 Oct 2026, 11:59 pm IST)"], // UTC says the 3rd, IST is already the 4th
    ["2026-10-01T00:00:00Z", "Due in 4 days (5 Oct 2026, 11:59 pm IST)"],
    ["2026-09-29T00:00:00Z", "Due in 6 days (5 Oct 2026, 11:59 pm IST)"],
    ["2026-09-28T00:00:00Z", "Due 5 Oct 2026, 11:59 pm IST"], // a week or more: date only
    ["2026-10-05T18:30:00Z", "Was due 5 Oct 2026, 11:59 pm IST"], // one minute late
  ])("at %s", (now, expected) => {
    expect(dueText(DUE, new Date(now))).toBe(expected);
  });
});

const base: StudentTask = {
  id: "t1",
  title: "Two sum",
  type: "coding",
  description: "",
  dueAt: DUE,
  status: "published",
  maxAttempts: 3,
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
  attemptsUsed: 0,
};
const before = new Date("2026-10-01T00:00:00Z");
const after = new Date("2026-10-06T00:00:00Z");

describe("taskChip", () => {
  it.each<[string, Partial<StudentTask>, Date, string, string]>([
    ["nothing sent, still open", {}, before, "warning", "Not started"],
    ["nothing sent, past due", {}, after, "danger", "Missed"],
    ["sent, waiting for a score", { attemptsUsed: 1 }, before, "info", "Being checked"],
    ["scored, tries left", { attemptsUsed: 1, bestScore: 6 }, before, "info", "Can improve · 2 tries left"],
    ["scored, one try left", { attemptsUsed: 2, bestScore: 6 }, before, "info", "Can improve · 1 try left"],
    ["scored, no tries left", { attemptsUsed: 3, bestScore: 6 }, before, "success", "Done"],
    ["full marks (Accepted)", { attemptsUsed: 1, bestScore: 10 }, before, "success", "Done"],
    ["scored, past due", { attemptsUsed: 1, bestScore: 6 }, after, "neutral", "Closed"],
  ])("%s", (_name, progress, now, tone, label) => {
    expect(taskChip({ ...base, ...progress }, now)).toEqual({ tone, label });
  });
});

describe("progressText", () => {
  it("shows the best score only once there is one", () => {
    expect(progressText(base, formatScore)).toBe("0 of 3 attempts used");
    expect(progressText({ ...base, attemptsUsed: 1, bestScore: 6 }, formatScore)).toBe("Best 6.0 / 10 · 1 of 3 attempts used");
  });
});
