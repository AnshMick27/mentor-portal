import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmissionHistory, statusLabel } from "@/components/student/SubmissionHistory";
import { SubmissionResultView } from "@/components/student/SubmissionResultView";
import { newestFirst, submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
import type { SubmissionResult } from "@/lib/validation/submission";

const now = new Date("2026-10-01T12:00:00+05:30");
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

const result: SubmissionResult = {
  score: 7,
  summary: "A clear, well-structured resume.",
  strengths: ["Strong projects", "Clean layout"],
  improvements: ["Quantify results", "Fix tense"],
  nextSteps: ["Add GitHub links"],
  criteria: [
    { name: "Projects (tech + impact)", score: 8, comment: "Good detail." },
    { name: "Grammar & consistency", score: 6.5, comment: "Mixed tenses." },
  ],
};

function view(id: string, attempt: number, createdAt: Date, extra: Partial<SubmissionView> = {}): SubmissionView {
  return { id, taskId: "t1", uid: "u1", type: "resume", attempt, createdAt, status: "done", content: `text ${id}`, ...extra };
}

describe("submissionDocToView", () => {
  const stored = {
    taskId: "t1",
    uid: "u1",
    type: "resume",
    attempt: 1,
    createdAt: { toDate: () => minutesAgo(5) },
    status: "done",
    content: "My resume",
    result,
  };

  it("parses a stored doc and turns the Timestamp into a Date", () => {
    expect(submissionDocToView("s1", stored)).toEqual({ ...stored, id: "s1", createdAt: minutesAgo(5) });
  });

  it("skips malformed docs", () => {
    expect(submissionDocToView("s1", { ...stored, status: "weird" })).toBeUndefined();
    expect(submissionDocToView("s1", { ...stored, createdAt: "yesterday" })).toBeUndefined();
  });

  it("sorts newest first, and by attempt when times tie", () => {
    const sorted = newestFirst([view("a", 1, minutesAgo(30)), view("c", 2, minutesAgo(5)), view("b", 1, minutesAgo(5))]);
    expect(sorted.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("SubmissionResultView", () => {
  const html = renderToStaticMarkup(<SubmissionResultView result={result} />);

  it("shows score, summary, criteria table, strengths, improvements and next steps", () => {
    expect(html).toContain("7.0");
    expect(html).toContain("A clear, well-structured resume.");
    expect(html).toContain("<table");
    expect(html).toContain("Projects (tech + impact)");
    expect(html).toContain("Mixed tenses.");
    expect(html).toContain("6.5");
    for (const heading of ["What went well", "What to improve", "Next steps"]) expect(html).toContain(heading);
    expect(html).toContain("Add GitHub links");
  });

  it("shows judge counts when present and skips an empty criteria table", () => {
    const coding = renderToStaticMarkup(
      <SubmissionResultView
        result={{ ...result, criteria: [], judge: { passed: 2, total: 3, verdict: "Wrong Answer on test 3" } }}
      />,
    );
    expect(coding).toContain("Passed 2 of 3 tests · Wrong Answer on test 3");
    expect(coding).not.toContain("<table");
  });
});

describe("SubmissionHistory", () => {
  it("says when there are no attempts", () => {
    expect(renderToStaticMarkup(<SubmissionHistory submissions={[]} now={now} />)).toContain("No attempts yet");
  });

  it("lists attempts newest first with IST times, expanding only the newest", () => {
    const html = renderToStaticMarkup(
      <SubmissionHistory
        submissions={[view("old", 1, minutesAgo(120), { result: { ...result, score: 5 } }), view("new", 2, minutesAgo(3), { result })]}
        now={now}
      />,
    );
    expect(html.indexOf("Attempt 2")).toBeLessThan(html.indexOf("Attempt 1"));
    expect(html).toContain("IST");
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html).toContain("7.0 / 10");
    expect(html).toContain("5.0 / 10");
    expect(html).toContain("text new");
  });

  it("explains errors (incl. timed-out ones) as not counted and shows pending attempts", () => {
    const html = renderToStaticMarkup(
      <SubmissionHistory
        submissions={[
          view("err", 1, minutesAgo(30), { status: "error", error: "The AI could not mark this." }),
          view("stuck", 2, minutesAgo(20), { status: "running" }),
          view("busy", 3, minutesAgo(1), { status: "running" }),
        ]}
        now={now}
      />,
    );
    expect(html).toContain("The AI could not mark this. This attempt was not counted");
    expect(html).toContain("Judge timed out, attempt not counted");
    expect(html).toContain("Your feedback is being prepared");
  });

  it("labels each status", () => {
    expect(statusLabel(view("a", 1, minutesAgo(1), { result }), now)).toBe("7.0 / 10");
    expect(statusLabel(view("a", 1, minutesAgo(1), { status: "queued" }), now)).toBe("Waiting…");
    expect(statusLabel(view("a", 1, minutesAgo(1), { status: "running" }), now)).toBe("Checking…");
    expect(statusLabel(view("a", 1, minutesAgo(11), { status: "running" }), now)).toBe("Not counted");
  });
});
