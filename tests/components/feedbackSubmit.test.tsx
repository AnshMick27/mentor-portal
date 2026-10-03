import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { FeedbackReady, SubmitFooter } from "@/components/student/FeedbackSubmitParts";
import { IntroSubmitForm } from "@/components/student/IntroSubmitForm";
import { resumeDisabledReason } from "@/components/student/ResumeSubmitForm";
import { SubmissionResultView } from "@/components/student/SubmissionResultView";
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
  it("keeps the form open after the due date, saying first that late work is not scored (T44)", () => {
    const html = render(introTask, 0, new Date("2026-11-01T00:00:00Z"));
    expect(html).toContain("This task is past its due date. You will get feedback, but it will not be scored.");
    expect(html).toContain("<textarea");
    expect(html).not.toContain("Your best score counts");
    expect(html.indexOf("past its due date")).toBeLessThan(html.indexOf("<textarea"));
  });

  it("shows no late note before the due date", () => {
    expect(render(introTask, 0)).not.toContain("past its due date");
  });

  it("labels the feedback of a late attempt as not scored (T44)", () => {
    const result = { score: 8, summary: "Good.", strengths: [], improvements: [], nextSteps: [] };
    expect(renderToStaticMarkup(<FeedbackReady result={result} late />)).toContain("Feedback ready (late, not scored: 8.0 / 10)");
    expect(renderToStaticMarkup(<FeedbackReady result={result} />)).toContain("Feedback ready: 8.0 / 10");
  });

  it("explains used-up attempts instead of showing the form", () => {
    const html = render(resumeTask, 3);
    expect(html).toContain("You have used all 3 attempts");
    expect(html).not.toContain('type="file"');
  });
});

describe("submit feedback notes", () => {
  it("shows progress while the AI works and the server's message on error", () => {
    const busy = renderToStaticMarkup(<SubmitFooter state={{ status: "submitting" }} />);
    expect(busy).toContain("Getting feedback…");
    expect(busy).toContain("up to a minute");
    const failed = renderToStaticMarkup(<SubmitFooter state={{ status: "error", message: "No attempts left." }} />);
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

describe("disabled reasons, order and headings (T35h)", () => {
  it("the intro form says why Submit is greyed out and puts the counter right under the field", () => {
    const html = renderToStaticMarkup(<IntroSubmitForm state={{ status: "idle" }} onSubmit={() => {}} />);
    expect(html).toContain('aria-describedby="submit-reason"');
    expect(html).toContain('<p id="submit-reason" class="text-sm text-muted">Write at least 300 characters (0 so far).</p>');
    expect(html).not.toContain("aria-live");
    const field = html.indexOf('id="intro-text"');
    expect(field).toBeLessThan(html.indexOf('id="intro-count"'));
    expect(html.indexOf('id="intro-count"')).toBeLessThan(html.indexOf('href="/privacy"'));
  });

  it("names each reason the resume Submit button is off", () => {
    expect(resumeDisabledReason(0, false, false)).toBe("Add your resume text (or choose a PDF) to submit.");
    expect(resumeDisabledReason(9_000, true, false)).toBe("Shorten your resume text to submit.");
    expect(resumeDisabledReason(10, false, true)).toBe("Wait until your PDF has been read.");
    expect(resumeDisabledReason(10, false, false)).toBeUndefined();
  });

  it("feedback lists use h3, never a skipped level", () => {
    const html = renderToStaticMarkup(
      <SubmissionResultView result={{ score: 6, summary: "", strengths: ["Clear"], improvements: ["Shorter"], nextSteps: [] }} />,
    );
    expect(html).toContain("<h3");
    expect(html).not.toContain("<h4");
  });
});
