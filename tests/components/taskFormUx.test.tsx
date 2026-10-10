import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DescriptionField, LeaveConfirm, TaskForm, taskFieldErrors } from "@/components/tasks/TaskForm";
import { emptyTaskForm, formToTaskInput } from "@/lib/tasks/taskForm";
import { taskInputSchema } from "@/lib/validation/task";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const noop = () => undefined;

describe("Write/Preview toggle (UX-21)", () => {
  it("uses two 44 px toggle buttons with aria-pressed, not fake tabs", () => {
    const html = renderToStaticMarkup(<DescriptionField value="# Hi" preview={false} onPreview={noop} onChange={noop} />);
    expect(html).not.toContain('role="tab');
    expect(html).toMatch(/<button type="button" aria-pressed="true"[^>]*min-h-11[^>]*>Write<\/button>/);
    expect(html).toMatch(/<button type="button" aria-pressed="false"[^>]*>Preview<\/button>/);
    expect(html).toContain("<textarea");
  });

  it("shows the rendered preview in a labelled region", () => {
    const html = renderToStaticMarkup(<DescriptionField value="# Hi" preview onPreview={noop} onChange={noop} />);
    expect(html).toContain('role="region" aria-labelledby="description-label"');
    expect(html).toContain("<h3>Hi</h3>");
    expect(html).not.toContain("<textarea");
  });

  it("ties a description error to the textarea", () => {
    const html = renderToStaticMarkup(<DescriptionField value="" preview={false} error="Add a description." onPreview={noop} onChange={noop} />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="description-error"');
    expect(html).toContain('<p id="description-error"');
  });
});

describe("field errors (UX-21)", () => {
  it("maps every zod issue of an empty coding task to its own field", () => {
    const form = { ...emptyTaskForm(), type: "coding" as const, dueAtLocal: "2026-10-05T23:59", timeLimitMs: "50", languages: [] };
    const parsed = taskInputSchema.safeParse(formToTaskInput(form));
    expect(parsed.success).toBe(false);
    const { fields } = taskFieldErrors(parsed.success ? [] : parsed.error.issues);
    expect(fields.title).toBeTruthy();
    expect(fields.description).toBeTruthy();
    expect(fields.problemSlug).toBeTruthy();
    expect(fields.languages).toBeTruthy();
    expect(fields.timeLimitMs).toBeTruthy();
  });

  it("maps dueAt to the due date field and keeps unknown paths as a general message", () => {
    const { fields, other } = taskFieldErrors([
      { path: ["dueAt"], message: "Choose a valid date." },
      { path: ["coding", "sampleTests", 0, "input"], message: "Too long." },
      { path: [], message: "Something else." },
    ]);
    expect(fields).toEqual({ dueAtLocal: "Choose a valid date.", sampleTests: "Too long." });
    expect(other).toBe("Something else.");
  });
});

describe("task form labels and controls", () => {
  const html = renderToStaticMarkup(
    <TaskForm
      mode="new"
      initial={{ ...emptyTaskForm(), type: "coding", sampleTests: [{ input: "1", output: "1" }, { input: "2", output: "2" }] }}
    />,
  );

  it("marks the required fields", () => {
    for (const label of ["Title (required)", "Description (markdown, required)", "Due date and time (IST, required)", "Problem slug (required)"]) {
      expect(html).toContain(label);
    }
  });

  it("names each sample's Remove button for screen readers", () => {
    expect(html).toContain('aria-label="Remove sample 1"');
    expect(html).toContain('aria-label="Remove sample 2"');
  });

  it("does not ask to confirm before anything was changed", () => {
    expect(html).not.toContain("Leave without saving?");
  });
});

describe("scenario grading notes (T50)", () => {
  it("shows the hidden notes field for scenario tasks only, with the stored notes", () => {
    const scenario = renderToStaticMarkup(
      <TaskForm mode="new" initial={{ ...emptyTaskForm(), type: "scenario", gradingNotes: "Tells the lead early." }} />,
    );
    expect(scenario).toContain("Grading notes (hidden from students)");
    expect(scenario).toContain("Tells the lead early.");
    expect(scenario).toContain('<option value="scenario" selected="">Scenario</option>');
    expect(renderToStaticMarkup(<TaskForm mode="new" initial={{ ...emptyTaskForm(), type: "intro_written" }} />)).not.toContain(
      "Grading notes",
    );
  });

  it("maps a gradingNotes error to its field", () => {
    expect(taskFieldErrors([{ path: ["gradingNotes"], message: "Too long." }]).fields).toEqual({ gradingNotes: "Too long." });
  });
});

describe("leave confirm", () => {
  it("asks before throwing edits away, with a clear way to stay", () => {
    const html = renderToStaticMarkup(<LeaveConfirm onLeave={noop} onStay={noop} />);
    expect(html).toContain("Leave without saving?");
    expect(html).toContain("Your changes to this task will be lost.");
    expect(html).toContain(">Leave without saving</button>");
    expect(html).toContain(">Stay here</button>");
  });
});
