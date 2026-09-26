import { describe, expect, it } from "vitest";
import { emptyTaskForm, formToTaskInput, taskToForm, taskToPatch } from "@/lib/tasks/taskForm";
import { taskInputSchema, type TaskDto } from "@/lib/validation/task";

const coding = {
  problemSlug: "two-sum",
  languages: ["cpp" as const],
  sampleTests: [{ input: "1 2", output: "3" }],
  timeLimitMs: 1500,
};

const codingDto: TaskDto = {
  id: "t1",
  title: "Two sum",
  type: "coding",
  description: "Add **two** numbers.",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "published",
  maxAttempts: 4,
  coding,
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

describe("task form conversion", () => {
  it("starts as a coding draft with every language and one empty sample", () => {
    expect(emptyTaskForm()).toMatchObject({
      type: "coding",
      status: "draft",
      languages: ["cpp", "java", "python"],
      sampleTests: [{ input: "", output: "" }],
    });
  });

  it("round-trips a stored task through the form into a valid input", () => {
    const form = taskToForm(codingDto);
    expect(form.dueAtLocal).toBe("2026-10-05T23:59");
    const parsed = taskInputSchema.parse(formToTaskInput(form));
    expect(parsed).toEqual({
      title: "Two sum",
      type: "coding",
      description: "Add **two** numbers.",
      dueAt: "2026-10-05T23:59:00+05:30",
      status: "published",
      maxAttempts: 4,
      coding,
    });
  });

  it("drops coding settings from the input when the type is not coding", () => {
    const form = { ...taskToForm(codingDto), type: "resume" as const };
    const input = formToTaskInput(form);
    expect(input.coding).toBeUndefined();
    expect(taskInputSchema.safeParse(input).success).toBe(true);
  });

  it("uses the per-type default when max attempts is blank", () => {
    const form = { ...taskToForm(codingDto), maxAttempts: "  " };
    expect(taskInputSchema.parse(formToTaskInput(form)).maxAttempts).toBe(5);
  });

  it("lets the schema reject junk numbers and a missing due date", () => {
    expect(taskInputSchema.safeParse(formToTaskInput({ ...taskToForm(codingDto), timeLimitMs: "" })).success).toBe(false);
    expect(taskInputSchema.safeParse(formToTaskInput({ ...taskToForm(codingDto), maxAttempts: "abc" })).success).toBe(false);
    expect(taskInputSchema.safeParse(formToTaskInput({ ...taskToForm(codingDto), dueAtLocal: "" })).success).toBe(false);
  });

  it("builds a PATCH body that clears coding for non-coding tasks", () => {
    const resume = taskInputSchema.parse(formToTaskInput({ ...taskToForm(codingDto), type: "resume" }));
    expect(taskToPatch(resume)).toMatchObject({ type: "resume", coding: null });
    const code = taskInputSchema.parse(formToTaskInput(taskToForm(codingDto)));
    expect(taskToPatch(code).coding).toEqual(coding);
  });
});
