import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskSubmissionsView } from "@/components/mentor/TaskSubmissions";
import type { TaskRosterData } from "@/lib/tasks/rosterQuery";
import { rosterStudents } from "@/lib/tasks/submissionRoster";

const data: TaskRosterData = {
  task: {
    id: "t1",
    title: "Self intro",
    type: "intro_written",
    description: "",
    dueAt: "2026-10-05T18:29:00.000Z",
    status: "published",
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  students: rosterStudents([
    { uid: "s1", name: "Kabir Singh", email: "k@x.in", rollNo: "0827CI1", branch: "CSIT", onboarded: true, removed: false },
    { uid: "s2", name: "Diya Patel", email: "d@x.in", rollNo: "0827IT2", branch: "IT", onboarded: true, removed: false },
  ]),
  submissions: [
    {
      id: "x1",
      taskId: "t1",
      uid: "s2",
      type: "intro_written",
      attempt: 1,
      createdAt: new Date("2026-10-02T06:30:00Z"),
      status: "done",
      content: "secret text",
      result: { score: 7.5, summary: "", strengths: [], improvements: [], nextSteps: [] },
    },
  ],
};

const render = (branch: "all" | "CSIT") =>
  renderToStaticMarkup(
    <TaskSubmissionsView data={data} branch={branch} onBranch={() => undefined} now={new Date("2026-10-03T00:00:00Z")} />,
  );

describe("TaskSubmissionsView", () => {
  it("lists who has not submitted and who has, with links, best score and attempts", () => {
    const html = render("all");
    expect(html).toContain("1</span> of 2 submitted");
    expect(html).toContain("Not submitted");
    expect(html).toContain('href="/mentor/students/s1"');
    expect(html).toContain("Kabir Singh");
    expect(html).toContain('href="/mentor/students/s2"');
    expect(html).toContain("Best 7.5 / 10");
    expect(html).toContain("1 attempt · Last 2 Oct 2026, 12:00 pm IST");
    expect(html).not.toContain("secret text");
  });

  it("narrows to one branch", () => {
    const html = render("CSIT");
    expect(html).toContain("0</span> of 1 submitted");
    expect(html).toContain("Nobody has submitted yet.");
    expect(html).not.toContain("Diya Patel");
  });

  it("tags a student who only sent late work, and keeps them under Not submitted (T44)", () => {
    const lateData = { ...data, submissions: [...data.submissions, { ...data.submissions[0], id: "x2", uid: "s1", late: true }] };
    const html = renderToStaticMarkup(
      <TaskSubmissionsView data={lateData} branch="all" onBranch={() => undefined} now={new Date("2026-10-03T00:00:00Z")} />,
    );
    expect(html).toContain("1</span> of 2 submitted");
    expect(html).toContain(">Sent late</span>");
    expect(html.indexOf("Sent late")).toBeLessThan(html.indexOf(">Submitted"));
  });
});
