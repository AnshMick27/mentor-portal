import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskSubmissionsView } from "@/components/mentor/TaskSubmissions";
import type { TaskRosterData } from "@/lib/tasks/rosterQuery";
import { rosterStudents, similarRows } from "@/lib/tasks/submissionRoster";

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

describe("Similar submissions (T47)", () => {
  const pair = { uidA: "s1", uidB: "s2", submissionIdA: "x0", submissionIdB: "x1", percent: 92 };
  const view = (extra: Partial<TaskRosterData>, branch: "all" | "CSIT" = "all") =>
    renderToStaticMarkup(
      <TaskSubmissionsView data={{ ...data, ...extra }} branch={branch} onBranch={() => undefined} now={new Date("2026-10-03T00:00:00Z")} />,
    );

  it("lists both students with links and how alike their answers are", () => {
    const html = view({ similarPairs: [pair] });
    const section = html.slice(html.indexOf("Similar submissions"));
    expect(section).toContain('href="/mentor/students/s1"');
    expect(section).toContain('href="/mentor/students/s2"');
    expect(section).toContain("92% alike");
    expect(section).toContain("A hint, not proof");
  });

  it("says when nothing looks alike, also before the first recompute", () => {
    expect(view({ similarPairs: [] })).toContain("No answers look alike.");
    expect(view({})).toContain("No answers look alike.");
  });

  it("has no section for a resume task", () => {
    expect(view({ task: { ...data.task, type: "resume" }, similarPairs: [pair] })).not.toContain("Similar submissions");
  });

  it("keeps a pair when either student is in the branch filter, and drops students no longer on the roster", () => {
    expect(similarRows([pair], data.students, "CSIT")).toHaveLength(1); // s1 is CSIT, s2 is IT
    expect(similarRows([pair], data.students, "CSE")).toEqual([]);
    expect(similarRows([{ ...pair, uidB: "gone" }], data.students, "all")).toEqual([]);
  });
});
