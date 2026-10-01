import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentDashboard } from "@/components/student/StudentDashboard";
import type { StudentDashboardData } from "@/lib/dashboard/studentQueries";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const resumeTask: TaskDto = {
  id: "r1",
  title: "Resume review",
  type: "resume",
  description: "",
  dueAt: "2026-10-03T18:29:00.000Z",
  status: "published",
  maxAttempts: 3,
  createdBy: "m1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};
const codingTask: TaskDto = { ...resumeTask, id: "c1", title: "Two sum", type: "coding" };

function result(id: string, taskId: string, score: number): SubmissionView {
  return {
    id,
    taskId,
    uid: "u1",
    type: taskId === "c1" ? "coding" : "resume",
    attempt: 1,
    createdAt: new Date("2026-09-30T06:30:00Z"),
    status: "done",
    content: "text",
    result: { score, summary: `Summary ${id}`, strengths: ["Clear"], improvements: [], nextSteps: [] },
  };
}

const full: StudentDashboardData = {
  tasks: [resumeTask, codingTask],
  week: [
    { ...codingTask, attemptsUsed: 0 },
    { ...resumeTask, attemptsUsed: 1, bestScore: 7.5 },
  ],
  latest: [result("s1", "r1", 7.5), result("s2", "gone", 4), result("s3", "c1", 10)],
  stats: {
    name: "Asha",
    rollNo: "0827CS1",
    branch: "CSE",
    tasksDue: 3,
    tasksSubmitted: 2,
    missedCount: 1,
    avgBySkill: { coding: 10, resume: 7.5 },
    overallAvg: 8.8,
    recentScores: [],
    latestNextSteps: ["Quantify impact", "Add links", "Fix grammar", "Fourth step"],
    needsAttention: true,
    needsAttentionReason: "Missed 2 of the last 4 tasks",
    updatedAt: ts("2026-09-30T00:00:00Z"),
  },
};

const render = (data: StudentDashboardData) => renderToStaticMarkup(<StudentDashboard name="Asha" data={data} />);

describe("StudentDashboard", () => {
  it("shows summary numbers, skill averages and this week's tasks with their state", () => {
    const html = render(full);
    expect(html).toContain("Hi, Asha");
    expect(html).toContain("8.8 / 10");
    expect(html).toContain("Coding</dt>");
    expect(html).not.toContain("Written intro</dt>"); // no intro score yet
    expect(html).toContain('href="/student/tasks/c1"');
    expect(html).toContain("Not submitted yet");
    expect(html).toContain("Submitted · Best 7.5 / 10");
    expect(html).toContain('href="/student/tasks"');
  });

  it("lists the latest results expandable, newest open, with a type label when the task is gone", () => {
    const html = render(full);
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html).toContain("Summary s1");
    expect(html).toContain(">Resume<"); // task "gone" falls back to its type label
  });

  it("shows at most 3 next steps and never the needs-attention flag", () => {
    const html = render(full);
    expect(html).toContain("Fix grammar");
    expect(html).not.toContain("Fourth step");
    expect(html).not.toContain("Missed 2 of the last 4 tasks");
  });

  it("has friendly empty states for a brand-new student without stats", () => {
    const html = render({ tasks: [], week: [], latest: [] });
    expect(html).toContain("Nothing due in the next 7 days.");
    expect(html).toContain("No feedback yet.");
    expect(html).toContain("Your next steps appear here");
    expect(html).toContain("—");
  });
});
