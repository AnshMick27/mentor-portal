import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentProfile } from "@/components/mentor/StudentProfile";
import type { StudentProfileData } from "@/lib/dashboard/profileQueries";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import type { TaskDto } from "@/lib/validation/task";

const now = new Date("2026-10-01T12:00:00Z");
const ts = { toDate: () => now };

const task: TaskDto = {
  id: "t1",
  title: "Resume review",
  type: "resume",
  description: "",
  dueAt: "2026-09-28T18:29:00.000Z",
  status: "published",
  maxAttempts: 3,
  createdBy: "m1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const attempt: SubmissionView = {
  id: "a1",
  taskId: "t1",
  uid: "s1",
  type: "resume",
  attempt: 1,
  createdAt: new Date("2026-09-27T10:00:00Z"),
  status: "done",
  content: "MY RESUME <b>TEXT</b>",
  result: { score: 7.5, summary: "Solid draft.", strengths: ["Clear"], improvements: [], nextSteps: [] },
};

const data: StudentProfileData = {
  uid: "s1",
  user: { name: "Kabir Singh", email: "kabir@college.ac.in", role: "student", onboarded: true, rollNo: "0827CI1", branch: "CSIT", showOnLeaderboard: false },
  stats: {
    name: "Kabir Singh",
    rollNo: "0827CI1",
    branch: "CSIT",
    tasksDue: 3,
    tasksSubmitted: 1,
    missedCount: 2,
    avgBySkill: { resume: 7.5 },
    overallAvg: 7.5,
    recentScores: [],
    latestNextSteps: [],
    needsAttention: true,
    needsAttentionReason: "Missed 2 of the last 3 tasks",
    showOnLeaderboard: false,
    updatedAt: ts,
  },
  tasks: [task, { ...task, id: "t2", title: "Missed task", dueAt: "2026-09-20T18:29:00.000Z" }],
  firstPage: { submissions: [attempt] },
};

const render = (props: Partial<Parameters<typeof StudentProfile>[0]> = {}) =>
  renderToStaticMarkup(
    <StudentProfile
      data={data}
      submissions={[attempt, { ...attempt, id: "x1", taskId: "gone" }]}
      now={now}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      {...props}
    />,
  );

describe("StudentProfile", () => {
  it("shows identity, the needs-attention reason and stats", () => {
    const html = render();
    expect(html).toContain("Kabir Singh");
    expect(html).toContain("0827CI1 · CSIT</p>");
    expect(html).toContain('<p class="break-all">kabir@college.ac.in</p>'); // email on its own line (UX-31)
    expect(html).toContain("Needs attention: Missed 2 of the last 3 tasks");
    expect(html).toContain("7.5 / 10");
    expect(html).toContain('href="/mentor/students"'); // back link goes to the student list (UX-17)
  });

  it("lists every task with state, attempts and full results, labelled for a mentor", () => {
    const html = render();
    expect(html).toContain("Submitted</span> · 1 of 3 attempts · Best 7.5 / 10");
    expect(html).toContain("Missed</span> · 0 of 3 attempts");
    expect(html).toContain("Solid draft.");
    expect(html).toContain("What they sent");
    expect(html).not.toContain("What you sent");
    expect(html).toContain("MY RESUME &lt;b&gt;TEXT&lt;/b&gt;"); // student text is escaped
    expect(html).toContain("1 more attempt on tasks that are no longer published.");
  });

  it("offers older attempts only when there are more pages", () => {
    expect(render()).not.toContain("Load older attempts");
    expect(render({ hasMore: true })).toContain("Load older attempts");
    expect(render({ hasMore: true, loadingMore: true })).toContain("Loading…");
  });

  it("shows the mentor's controls and a note when the student was removed", () => {
    const html = render({ data: { ...data, user: { ...data.user, removed: true } }, actions: <button type="button">Restore access</button> });
    expect(html).toContain("Restore access");
    expect(html).toContain("Removed from the portal: this student cannot sign in");
    expect(render()).not.toContain("Removed from the portal");
  });

  it("copes with a student who has no stats doc or roll number yet", () => {
    const html = render({
      data: { ...data, stats: undefined, user: { ...data.user, rollNo: undefined, branch: undefined } },
      submissions: [],
    });
    expect(html).toContain("No roll number yet · —");
    expect(html).not.toContain("Needs attention");
    expect(html).toContain("No attempts.");
  });
});
