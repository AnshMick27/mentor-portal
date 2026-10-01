import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MentorDashboardView } from "@/components/mentor/MentorDashboard";
import type { MentorStudent } from "@/lib/dashboard/mentor";
import type { MentorDashboardData } from "@/lib/dashboard/mentorQueries";
import type { TaskDto } from "@/lib/validation/task";

const ts = { toDate: () => new Date("2026-10-01T00:00:00Z") };
const base = {
  tasksDue: 1,
  tasksSubmitted: 0,
  missedCount: 1,
  avgBySkill: {},
  recentScores: [],
  latestNextSteps: [],
  showOnLeaderboard: false,
  updatedAt: ts,
};
const students: MentorStudent[] = [
  { ...base, uid: "s1", name: "Kabir Singh", rollNo: "0827CI1", branch: "CSIT", needsAttention: true, needsAttentionReason: "Missed 2 of the last 3 tasks" },
  { ...base, uid: "s2", name: "Diya Patel", rollNo: "0827IT2", branch: "IT", needsAttention: false, avgBySkill: { coding: 10 } },
];
const task: TaskDto = {
  id: "t1",
  title: "Sum of two numbers",
  type: "coding",
  description: "",
  dueAt: "2026-09-23T18:29:00.000Z",
  status: "published",
  maxAttempts: 5,
  createdBy: "m1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const data: MentorDashboardData = {
  tasks: [task, { ...task, id: "t2", title: "Fresh task" }],
  taskStats: new Map([["t1", { submittedCount: 1, notSubmittedUids: ["s1"], avgScore: 10, avgScoreByBranch: { IT: 10 }, updatedAt: ts }]]),
  students,
};

const render = (branch: "all" | "IT" | "CSIT", d = data) =>
  renderToStaticMarkup(<MentorDashboardView data={d} branch={branch} onBranch={() => undefined} />);

describe("MentorDashboardView", () => {
  it("shows task status with an expandable, linked list of non-submitters", () => {
    const html = render("all");
    expect(html).toContain("1</span> of 2 submitted · Average 10.0");
    expect(html).toContain("<details>");
    expect(html).toContain("1 not submitted");
    expect(html).toContain('href="/mentor/students/s1"');
    expect(html).toContain("0827CI1");
    expect(html).toContain("No numbers yet"); // t2 has no stats doc yet
  });

  it("lists students needing attention with the reason, and the class overview", () => {
    const html = render("all");
    expect(html).toContain("Needs attention (1)");
    expect(html).toContain("Missed 2 of the last 3 tasks");
    expect(html).toContain("Average per task");
    expect(html).toContain("1 student with a score");
  });

  it("filters everything by branch and offers only branches that have students", () => {
    const itBranch = render("IT");
    expect(itBranch).toContain("Needs attention (0)");
    expect(itBranch).toContain("Everyone has submitted.");
    expect(itBranch).toContain('<option value="CSIT">');
    expect(itBranch).not.toContain('<option value="ME">');
    expect(render("CSIT")).toContain("0</span> of 1 submitted · Average —");
  });

  it("has empty states when there are no tasks or students", () => {
    const html = render("all", { tasks: [], taskStats: new Map(), students: [] });
    expect(html).toContain("No published tasks yet.");
    expect(html).toContain("Nobody is flagged right now.");
    expect(html).toContain("All branches (0 students)");
  });
});
