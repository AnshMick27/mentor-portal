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

describe("submitAvailability", () => {
  it("is open with the attempts left before the deadline", () => {
    expect(submitAvailability(task, 0, before)).toEqual({ open: true, attemptsLeft: 3 });
    expect(submitAvailability(task, 2, before)).toEqual({ open: true, attemptsLeft: 1 });
  });

  it("is still open exactly at dueAt (the server allows now <= dueAt) and closed one ms later", () => {
    expect(submitAvailability(task, 0, new Date(task.dueAt)).open).toBe(true);
    const late = submitAvailability(task, 0, new Date(Date.parse(task.dueAt) + 1));
    expect(late).toEqual({ open: false, reason: expect.stringContaining("due date has passed") });
  });

  it("is closed once every attempt is used", () => {
    expect(submitAvailability(task, 3, before)).toEqual({ open: false, reason: "You have used all 3 attempts for this task." });
  });
});
