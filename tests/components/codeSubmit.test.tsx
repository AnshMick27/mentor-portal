import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CodeSubmitForm } from "@/components/student/CodeSubmitForm";
import { SubmissionHistory, statusLabel } from "@/components/student/SubmissionHistory";
import { SubmissionResultView } from "@/components/student/SubmissionResultView";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import { AttemptsLeft, SentStatus } from "@/components/student/TaskSubmitSection";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const now = new Date("2026-10-01T12:00:00Z");
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

const task: TaskDto = {
  id: "t1",
  title: "Sum two numbers",
  type: "coding",
  description: "Add them.",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "published",
  maxAttempts: 2,
  coding: { problemSlug: "sum-two-numbers", languages: ["java", "python"], sampleTests: [{ input: "1 2", output: "3" }], timeLimitMs: 2000 },
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

function attempt(id: string, n: number, extra: Partial<SubmissionView>): SubmissionView {
  return {
    id,
    taskId: "t1",
    uid: "u1",
    type: "coding",
    attempt: n,
    createdAt: minutesAgo(1),
    status: "queued",
    content: "print(1)",
    language: "python",
    ...extra,
  };
}

const result = (judge: NonNullable<SubmissionView["result"]>["judge"], score: number) => ({
  score,
  summary: "judge summary",
  strengths: [],
  improvements: [],
  nextSteps: [],
  judge,
});

describe("CodeSubmitForm", () => {
  const html = renderToStaticMarkup(<CodeSubmitForm languages={["java", "python"]} state={{ status: "idle" }} onSubmit={() => {}} />);

  it("offers only the task's languages, first one selected", () => {
    expect(html).toMatch(/<select[^>]*id="code-language"/);
    expect(html).toContain('<option value="java" selected="">Java</option>');
    expect(html).toContain('<option value="python">Python</option>');
    expect(html).not.toContain('value="cpp"');
    expect(html).toContain("class must be named Main");
  });

  it("has a labelled monospace code box, a byte counter, and Submit disabled while empty", () => {
    expect(html).toMatch(/<label[^>]*for="code-text"/);
    expect(html).toMatch(/<textarea[^>]*id="code-text"[^>]*class="[^"]*font-mono/);
    expect(html).toMatch(/spellCheck="false"|spellcheck="false"/);
    expect(html).toContain("0.0 KB of 32 KB");
    expect(html).toContain("press Esc then Tab");
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });

  it("explains why Submit is greyed out, linked to the button", () => {
    expect(html).toContain('aria-describedby="code-submit-reason"');
    expect(html).toContain('<p id="code-submit-reason" class="text-sm text-muted">Paste or type your code to submit.</p>');
    expect(html).not.toContain("aria-live"); // counters don't speak on every key
    expect(html.indexOf('id="code-help"')).toBeLessThan(html.indexOf('id="code-text"')); // hint above the box
  });

  it("shows server errors", () => {
    const error = renderToStaticMarkup(
      <CodeSubmitForm languages={["python"]} state={{ status: "error", message: "Try again later." }} onSubmit={() => {}} />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain("Try again later.");
  });
});

describe("coding task page", () => {
  it("shows attempts left and the form while open", () => {
    const html = renderToStaticMarkup(<StudentTaskDetail task={task} submissions={[]} now={now} />);
    expect(html).toContain("Submit your code");
    expect(html).toContain("2 attempts left");
  });

  it("closes the form when all attempts are used (a waiting attempt counts)", () => {
    const subs = [
      attempt("a", 1, { status: "done", result: result({ passed: 1, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 }, 3.3) }),
      attempt("b", 2, { status: "running" }),
    ];
    const html = renderToStaticMarkup(<StudentTaskDetail task={task} submissions={subs} now={now} />);
    expect(html).toContain("You have used all 2 attempts");
    expect(html).not.toContain('id="code-text"');
  });
});

describe("coding attempt history", () => {
  it("labels waiting, running, timed-out and finished attempts", () => {
    expect(statusLabel(attempt("a", 1, { status: "queued" }), now)).toBe("Waiting for the judge…");
    expect(statusLabel(attempt("a", 1, { status: "running" }), now)).toBe("Running your code…");
    expect(statusLabel(attempt("a", 1, { status: "queued", createdAt: minutesAgo(11) }), now)).toBe("Not counted");
    const finished = attempt("a", 1, { status: "done", result: result({ passed: 3, total: 3, verdict: "Accepted" }, 10) });
    expect(statusLabel(finished, now)).toBe("10.0 / 10");
  });

  it("shows live judge status for a queued attempt and the timeout message for a stuck one", () => {
    const html = renderToStaticMarkup(
      <SubmissionHistory
        submissions={[attempt("new", 2, { status: "queued" }), attempt("old", 1, { status: "running", createdAt: minutesAgo(30) })]}
        now={now}
      />,
    );
    expect(html).toContain("Your code is in the queue");
    expect(html).toContain("Judge timed out, attempt not counted");
  });

  it("shows passed/total and 'Wrong Answer on test N' when done, without repeating the summary", () => {
    const html = renderToStaticMarkup(
      <SubmissionHistory
        submissions={[attempt("a", 1, { status: "done", result: result({ passed: 1, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 }, 3.3) })]}
        now={now}
      />,
    );
    expect(html).toContain("3.3");
    expect(html).toContain("Passed 1 of 3 tests · Wrong Answer on test 2");
    expect(html).not.toContain("judge summary");
  });

  it("shows compiler output in a scrollable monospace block", () => {
    const html = renderToStaticMarkup(
      <SubmissionResultView
        result={result({ passed: 0, total: 3, verdict: "Compilation Error", compileOutput: "main.cpp:3: error: expected ';'" }, 0)}
      />,
    );
    expect(html).toContain("Compiler output");
    expect(html).toMatch(/<pre class="[^"]*overflow-auto[^"]*font-mono[^"]*">main.cpp:3: error: expected &#x27;;&#x27;<\/pre>/);
  });
});

describe("live status right after sending (UX-08) and the last-attempt warning (UX-10)", () => {
  it("shows this attempt's judge status under the form once it appears", () => {
    const queued = attempt("new1", 1, { status: "queued" });
    const html = renderToStaticMarkup(<SentStatus state={{ status: "sent", submissionId: "new1" }} submissions={[queued]} now={now} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Full details are under “Your attempts” below.");
    expect(html).not.toContain("appears here in a moment");
  });

  it("says it was sent while the attempt has not arrived yet, and nothing before sending", () => {
    const waiting = renderToStaticMarkup(<SentStatus state={{ status: "sent", submissionId: "x" }} submissions={[]} now={now} />);
    expect(waiting).toContain("Sent to the judge. The status appears here in a moment.");
    expect(renderToStaticMarkup(<SentStatus state={{ status: "idle" }} submissions={[]} now={now} />)).toBe("");
  });

  it("warns before the last attempt only", () => {
    const last = renderToStaticMarkup(<AttemptsLeft count={1} />);
    expect(last).toContain("This is your last attempt.");
    expect(last).toContain("bg-amber-50");
    expect(renderToStaticMarkup(<AttemptsLeft count={2} />)).toBe('<p class="text-sm text-muted">2 attempts left. Your best score counts.</p>');
  });
});
