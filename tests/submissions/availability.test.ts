import { describe, expect, it } from "vitest";
import { submitAvailability } from "@/lib/submissions/availability";
import type { TaskDto } from "@/lib/validation/task";

const task: TaskDto = {
  id: "t1",
  title: "Resume review",
  type: "resume",
  description: "Upload your resume.",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "published",
  maxAttempts: 3,
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};
const before = new Date("2026-10-01T00:00:00Z");
const defaultCutoff = "2026-10-12T18:29:00.000Z"; // dueAt + 7 days

describe("submitAvailability", () => {
  it("is open with the attempts left before the deadline", () => {
    expect(submitAvailability(task, 0, before)).toEqual({ open: true, attemptsLeft: 3, late: false, lateUntil: defaultCutoff });
    expect(submitAvailability(task, 2, before)).toEqual({ open: true, attemptsLeft: 1, late: false, lateUntil: defaultCutoff });
  });

  it("is on time exactly at dueAt (the server allows now <= dueAt) and late, still open, one ms later (T44)", () => {
    expect(submitAvailability(task, 0, new Date(task.dueAt))).toMatchObject({ open: true, attemptsLeft: 3, late: false });
    expect(submitAvailability(task, 1, new Date(Date.parse(task.dueAt) + 1))).toMatchObject({ open: true, attemptsLeft: 2, late: true });
  });

  it("closes a past-due task once every attempt is used, late ones included", () => {
    expect(submitAvailability(task, 3, new Date(Date.parse(task.dueAt) + 1)).open).toBe(false);
  });

  it("is closed once every attempt is used", () => {
    expect(submitAvailability(task, 3, before)).toEqual({ open: false, reason: "You have used all 3 attempts for this task." });
  });

  it("stays open as late until 7 days after dueAt by default, then closes with the date (T49)", () => {
    expect(submitAvailability(task, 0, new Date(defaultCutoff))).toMatchObject({ open: true, late: true });
    expect(submitAvailability(task, 0, new Date(Date.parse(defaultCutoff) + 1))).toEqual({
      open: false,
      reason: "This task closed on 12 Oct 2026, 11:59 pm IST. It no longer takes submissions.",
    });
  });

  it("uses the mentor's lateUntil instead of the default", () => {
    const custom = { ...task, lateUntil: "2026-10-06T18:29:00.000Z" };
    expect(submitAvailability(custom, 0, new Date(custom.lateUntil))).toEqual({
      open: true,
      attemptsLeft: 3,
      late: true,
      lateUntil: custom.lateUntil,
    });
    expect(submitAvailability(custom, 0, new Date(Date.parse(custom.lateUntil) + 1)).open).toBe(false);
  });

  it("reports used-up attempts before a closed window", () => {
    expect(submitAvailability(task, 3, new Date("2026-11-01T00:00:00Z"))).toEqual({
      open: false,
      reason: "You have used all 3 attempts for this task.",
    });
  });
});
