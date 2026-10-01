import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudentTaskBoard } from "@/components/student/StudentTaskBoard";
import { StudentTaskDetail } from "@/components/student/StudentTaskDetail";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ getIdToken: async () => "token" }) }));

const codingTask: TaskDto = {
  id: "t1",
  title: "Two sum",
  type: "coding",
  description: "Find **two** numbers. <script>alert(1)</script>",
  dueAt: "2026-10-05T18:29:00.000Z",
  status: "published",
  maxAttempts: 5,
  coding: {
    problemSlug: "two-sum",
    languages: ["cpp", "python"],
    sampleTests: [{ input: "2 7 11\n9", output: "0 1" }],
    timeLimitMs: 2000,
  },
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const attempt: SubmissionView = {
  id: "s1",
  taskId: "t1",
  uid: "u1",
  type: "coding",
  attempt: 1,
  createdAt: new Date("2026-09-30T00:00:00Z"),
  status: "done",
  content: "print(1)",
  language: "python",
  result: { score: 7.5, summary: "", strengths: [], improvements: [], nextSteps: [] },
};

describe("StudentTaskDetail", () => {
  const html = renderToStaticMarkup(
    <StudentTaskDetail task={codingTask} submissions={[attempt]} now={new Date("2026-10-01T00:00:00Z")} />,
  );

  it("shows title, type, IST due date and attempts", () => {
    expect(html).toContain("Two sum");
    expect(html).toContain("Coding");
    expect(html).toContain("Due in 4 days (5 Oct 2026, 11:59 pm IST)");
    expect(html).toContain("Best 7.5 / 10 · 1 of 5 attempts used");
    expect(html).toContain(">Can improve · 4 tries left</span>");
    expect(html).toContain('href="#submit-heading"'); // "Go to submit" while open
    expect(html).toContain("Go to submit");
  });

  it("renders the description as sanitised markdown", () => {
    expect(html).toContain("<strong>two</strong>");
    expect(html).not.toContain("<script");
  });

  it("shows sample tests, languages and time limit, but not the judge slug", () => {
    expect(html).toContain("Sample 1");
    expect(html).toContain("0 1");
    expect(html).toContain("C++, Python");
    expect(html).toContain("2 s");
    expect(html).not.toContain("two-sum");
  });

  it("has the code submit form instead of the old coming-soon placeholder", () => {
    expect(html).toContain("Submit your code");
    expect(html).toMatch(/<textarea[^>]*id="code-text"/);
    expect(html).not.toContain("Coming soon");
  });

  it("says 'Was due' after the deadline", () => {
    const late = renderToStaticMarkup(
      <StudentTaskDetail task={codingTask} submissions={[]} now={new Date("2026-11-01T00:00:00Z")} />,
    );
    expect(late).toContain("Was due 5 Oct 2026, 11:59 pm IST");
    expect(late).toContain(">Missed</span>");
    expect(late).not.toContain("Go to submit");
  });
});

describe("StudentTaskBoard", () => {
  it("shows all three groups with counts and links to each task", () => {
    const html = renderToStaticMarkup(
      <StudentTaskBoard
        board={{ dueSoon: [{ ...codingTask, attemptsUsed: 0 }], submitted: [], missed: [] }}
        now={new Date("2026-10-01T00:00:00Z")}
      />,
    );
    expect(html).toContain("Due soon");
    expect(html).toContain("Submitted");
    expect(html).toContain("Missed");
    expect(html).toContain('href="/student/tasks/t1"');
    expect(html).toContain("0 of 5 attempts used");
    expect(html).toContain(">Not started</span>");
    expect(html).toContain("No missed tasks");
  });
});
