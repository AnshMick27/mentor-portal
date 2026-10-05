import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntegrityCheck } from "@/components/mentor/IntegrityCheck";
import { TaskSubmissionsView } from "@/components/mentor/TaskSubmissions";
import { AttemptList } from "@/components/student/SubmissionHistory";
import { flagsAcross, INTEGRITY_FLAG_LABEL, integrityDetails } from "@/lib/submissions/integrityDisplay";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import { buildTaskRoster, rosterStudents } from "@/lib/tasks/submissionRoster";
import type { TaskRosterData } from "@/lib/tasks/rosterQuery";
import { INTEGRITY_FLAGS, type StoredIntegrity } from "@/lib/validation/submission";

const now = new Date("2026-10-05T10:00:00Z");
const counts = { pastesBlocked: 4, largestInsert: 300, typedChars: 120, awayCount: 2, awayMs: 400_000, maxCharsPerSec: 6 };
const flagged: StoredIntegrity = { ...counts, elapsedMs: 40_000, flags: ["pastes_blocked", "more_than_typed", "long_away"] };

function attempt(id: string, uid: string, integrity?: StoredIntegrity, extra: Partial<SubmissionView> = {}): SubmissionView {
  return {
    id,
    taskId: "t1",
    uid,
    type: "coding",
    attempt: 1,
    createdAt: new Date("2026-10-05T09:00:00Z"),
    status: "done",
    content: "print(1)",
    language: "python",
    result: { score: 10, summary: "Accepted", strengths: [], improvements: [], nextSteps: [] },
    ...(integrity ? { integrity } : {}),
    ...extra,
  };
}

describe("integrity display helpers", () => {
  it("has plain words for every flag", () => {
    for (const flag of INTEGRITY_FLAGS) expect(INTEGRITY_FLAG_LABEL[flag].length).toBeGreaterThan(5);
  });

  it("joins the flags of several attempts, each once, in a fixed order", () => {
    expect(flagsAcross([{ integrity: { flags: ["long_away", "outside_form"] } }, { integrity: { flags: ["outside_form"] } }, {}])).toEqual([
      "outside_form",
      "long_away",
    ]);
  });

  it("puts the numbers in one line", () => {
    expect(integrityDetails(flagged)).toBe("Typed 120 characters · 4 pastes refused · Away 2 times (7 min) · Top speed 6 characters/s · Took 40 s");
    expect(integrityDetails({ flags: ["outside_form"] })).toBe("No typing counts (not sent from the form)");
  });
});

describe("IntegrityCheck", () => {
  it("shows a Check chip with the reasons", () => {
    const html = renderToStaticMarkup(<IntegrityCheck flags={["outside_form", "quick_answer"]} />);
    expect(html).toContain(">Check</span>");
    expect(html).toContain("Sent outside the form · Finished very soon after opening");
  });

  it("renders nothing without flags", () => {
    expect(renderToStaticMarkup(<IntegrityCheck flags={[]} />)).toBe("");
  });
});

describe("attempt list (student profile)", () => {
  it("shows mentors the chip, reasons, numbers and that the score is unchanged", () => {
    const html = renderToStaticMarkup(<AttemptList submissions={[attempt("a1", "s1", flagged)]} now={now} audience="mentor" />);
    expect(html).toContain(">Check</span>");
    expect(html).toContain(INTEGRITY_FLAG_LABEL.pastes_blocked);
    expect(html).toContain("Typed 120 characters");
    expect(html).toContain("The score is not changed.");
  });

  it("never shows students their flags", () => {
    const html = renderToStaticMarkup(<AttemptList submissions={[attempt("a1", "s1", flagged)]} now={now} audience="student" />);
    expect(html).not.toContain("Check");
    expect(html).not.toContain(INTEGRITY_FLAG_LABEL.pastes_blocked);
    expect(html).not.toContain("Typed 120");
  });

  it("shows no chip for an attempt without flags", () => {
    const html = renderToStaticMarkup(
      <AttemptList submissions={[attempt("a1", "s1", { ...counts, pastesBlocked: 0, flags: [] }), attempt("a2", "s1")]} now={now} audience="mentor" />,
    );
    expect(html).not.toContain(">Check</span>");
  });
});

describe("task submissions page", () => {
  const students = rosterStudents([
    { uid: "s1", name: "Kabir Singh", email: "k@x.in", rollNo: "0827CI1", branch: "CSIT", onboarded: true, removed: false },
    { uid: "s2", name: "Diya Patel", email: "d@x.in", rollNo: "0827IT2", branch: "IT", onboarded: true, removed: false },
    { uid: "s3", name: "Esha Rao", email: "e@x.in", rollNo: "0827CI3", branch: "CSIT", onboarded: true, removed: false },
  ]);
  const submissions = [
    attempt("x1", "s1", flagged),
    attempt("x2", "s2", { flags: ["outside_form"] }, { status: "queued", result: undefined, createdAt: new Date("2026-10-05T09:58:00Z") }),
    attempt("x3", "s3", { ...counts, pastesBlocked: 0, flags: [] }),
    attempt("x4", "s3", { flags: ["outside_form"] }, { status: "error", result: undefined, error: "judge failed" }),
  ];

  it("gives each roster row the flags of its counted attempts (failed ones left out)", () => {
    const roster = buildTaskRoster(students, submissions, "all", now);
    expect(roster.submitted.map((r) => [r.student.uid, r.flags])).toEqual([
      ["s3", []],
      ["s1", ["pastes_blocked", "more_than_typed", "long_away"]],
    ]);
    expect(roster.notSubmitted.map((r) => [r.student.uid, r.flags])).toEqual([["s2", ["outside_form"]]]);
  });

  it("shows the Check chip on flagged students in both lists, and not on others", () => {
    const data: TaskRosterData = {
      task: {
        id: "t1",
        title: "Sum",
        type: "coding",
        description: "",
        dueAt: "2026-10-06T18:29:00.000Z",
        status: "published",
        maxAttempts: 3,
        coding: { problemSlug: "sum", languages: ["python"], sampleTests: [], timeLimitMs: 2000 },
        createdBy: "m1",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      students,
      submissions,
    };
    const html = renderToStaticMarkup(<TaskSubmissionsView data={data} branch="all" onBranch={() => undefined} now={now} />);
    expect(html.match(/>Check<\/span>/g)?.length).toBe(2);
    expect(html).toContain(INTEGRITY_FLAG_LABEL.outside_form);
    expect(html).toContain(INTEGRITY_FLAG_LABEL.long_away);
  });
});
