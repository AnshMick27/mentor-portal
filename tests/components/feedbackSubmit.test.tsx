import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { FeedbackReady, SubmitFooter } from "@/components/student/FeedbackSubmitParts";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const base: Omit<TaskDto, "type" | "title" | "maxAttempts"> = {
  id: "t1",
  description: "Do it.",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "published",
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};
const resumeTask: TaskDto = { ...base, type: "resume", title: "Resume review", maxAttempts: 3 };
const introTask: TaskDto = { ...base, type: "intro_written", title: "Introduce yourself", maxAttempts: 3 };
const now = new Date("2026-10-01T00:00:00Z");
/** `count` finished attempts on the task. */
const done = (task: TaskDto, count: number): SubmissionView[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    taskId: task.id,
    uid: "u1",
    type: task.type,
    attempt: i + 1,
    createdAt: new Date(now.getTime() - (count - i) * 60_000),
    status: "done",
    content: "text",
    result: { score: 5 + i, summary: "ok", strengths: [], improvements: [], nextSteps: [] },
  }));
const render = (task: TaskDto, attemptsUsed = 0, at = now) =>
  renderToStaticMarkup(<StudentTaskDetail task={task} submissions={done(task, attemptsUsed)} now={at} />);

describe("resume submit area", () => {
  const html = render(resumeTask, 1);

  it("offers a PDF picker and an editable text box, with no 'Coming soon'", () => {
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="application/pdf,.pdf"');
    expect(html).toMatch(/<label[^>]*for="resume-text"/);
    expect(html).toMatch(/<textarea[^>]*id="resume-text"/);
    expect(html).toContain("Your PDF stays on your device");
    expect(html).not.toContain("Coming soon");
  });

  it("shows attempts left and the 12,000 character limit, and Submit starts disabled while empty", () => {
    expect(html).toContain("2 attempts left");
    expect(html).toContain("0 / 12,000 characters");
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });
});

describe("intro submit area", () => {
  const html = render(introTask);

  it("has a labelled textarea with a live word count and the character limit", () => {
    expect(html).toMatch(/<label[^>]*for="intro-text"/);
    expect(html).toMatch(/<textarea[^>]*id="intro-text"/);
    expect(html).toContain("0 words · Aim for at least 80 words.");
    expect(html).toContain("Write at least 300 characters (0 so far).");
    expect(html).toContain("3 attempts left");
  });
});

describe("closed submit area", () => {
  it("explains a passed due date instead of showing the form", () => {
    const html = render(introTask, 0, new Date("2026-11-01T00:00:00Z"));
    expect(html).toContain("due date has passed");
    expect(html).not.toContain("<textarea");
  });

  it("explains used-up attempts instead of showing the form", () => {
    const html = render(resumeTask, 3);
    expect(html).toContain("You have used all 3 attempts");
    expect(html).not.toContain('type="file"');
  });
});

describe("submit feedback notes", () => {
  it("shows progress while the AI works and the server's message on error", () => {
    const busy = renderToStaticMarkup(<SubmitFooter state={{ status: "submitting" }} disabled={false} />);
    expect(busy).toContain("Getting feedback…");
    expect(busy).toContain("up to a minute");
    const failed = renderToStaticMarkup(<SubmitFooter state={{ status: "error", message: "No attempts left." }} disabled={false} />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("No attempts left.");
  });

  it("shows the score with one decimal and the summary when feedback is ready", () => {
    const html = renderToStaticMarkup(
      <FeedbackReady result={{ score: 7, summary: "Clear and confident.", strengths: [], improvements: [], nextSteps: [] }} />,
    );
    expect(html).toContain("Feedback ready: 7.0 / 10");
    expect(html).toContain("Clear and confident.");
  });
});
