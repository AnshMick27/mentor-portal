import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AttemptList } from "@/components/student/SubmissionHistory";
import { TaskForm } from "@/components/tasks/TaskForm";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { emptyTaskForm } from "@/lib/tasks/taskForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const codingForm = { ...emptyTaskForm(), type: "coding" as const, problemSlug: "two-sum" };

describe("TaskForm lock", () => {
  it("disables the type and makes the problem slug read-only once a task has submissions", () => {
    const html = renderToStaticMarkup(<TaskForm mode="edit" taskId="t1" initial={codingForm} hasSubmissions />);
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toMatch(/<input[^>]*value="two-sum"[^>]*readOnly=""|<input[^>]*readOnly=""[^>]*value="two-sum"/);
    expect(html.match(/Locked: students have already submitted to this task\./g)).toHaveLength(2);
  });

  it("leaves both editable for new tasks and tasks without submissions", () => {
    for (const html of [
      renderToStaticMarkup(<TaskForm mode="edit" taskId="t1" initial={codingForm} hasSubmissions={false} />),
      renderToStaticMarkup(<TaskForm mode="new" initial={codingForm} />),
    ]) {
      expect(html).not.toMatch(/<select[^>]*disabled=""/);
      expect(html).not.toContain("readOnly");
      expect(html).not.toContain("Locked:");
    }
  });
});

describe("AttemptList wording", () => {
  const failed: SubmissionView = {
    id: "a1",
    taskId: "t1",
    uid: "s1",
    type: "resume",
    attempt: 1,
    createdAt: new Date("2026-09-27T10:00:00Z"),
    status: "error",
    content: "text",
    error: "The feedback service is busy right now.",
  };
  const pending: SubmissionView = { ...failed, id: "a2", status: "running", createdAt: new Date("2026-09-30T23:59:00Z"), error: undefined };
  const now = new Date("2026-10-01T00:00:00Z");

  it("speaks to the student on their own page", () => {
    const html = renderToStaticMarkup(<AttemptList submissions={[failed, pending]} now={now} />);
    expect(html).toContain("This attempt was not counted, so you can try again.");
    expect(html).toContain("This page updates by itself.");
    expect(html).toContain("What you sent");
  });

  it("speaks about the student on the mentor's profile view", () => {
    const html = renderToStaticMarkup(<AttemptList submissions={[failed, pending]} now={now} audience="mentor" />);
    expect(html).toContain("Not counted (the student can try again).");
    expect(html).toContain("Still being checked.");
    expect(html).toContain("What they sent");
    expect(html).not.toContain("so you can try again");
    expect(html).not.toContain("What you sent");
  });
});
