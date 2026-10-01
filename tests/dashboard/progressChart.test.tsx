import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressChart } from "@/components/student/ProgressChart";
import { progressChartData, progressRows } from "@/lib/dashboard/progressChart";
import { formatIstShortDate } from "@/lib/dates/ist";
import type { StoredStudentStats } from "@/lib/validation/stats";
import type { TaskType } from "@/lib/validation/task";

type Recent = StoredStudentStats["recentScores"];
const entry = (taskId: string, type: TaskType, score: number, iso: string): Recent[number] => ({
  taskId,
  type,
  score,
  at: { toDate: () => new Date(iso) },
});

// Newest first, as studentStats stores them.
const recent: Recent = [
  entry("i1", "intro_written", 6.5, "2026-09-30T05:00:00Z"),
  entry("c1", "coding", 10, "2026-09-25T20:00:00Z"), // 26 Sep 01:30 IST
  entry("r1", "resume", 7, "2026-09-20T06:00:00Z"),
];

describe("formatIstShortDate", () => {
  it("uses the IST calendar day", () => {
    expect(formatIstShortDate(Date.parse("2026-09-25T20:00:00Z"))).toMatch(/^26 Sep/);
    expect(formatIstShortDate(Number.NaN)).toBe("—");
  });
});

describe("progressChartData", () => {
  it("orders points oldest first, one key per point for that task's skill", () => {
    const data = progressChartData(recent);
    expect(data.points.map((p) => [p.taskId, p.resume, p.coding, p.intro_written])).toEqual([
      ["r1", 7, undefined, undefined],
      ["c1", undefined, 10, undefined],
      ["i1", undefined, undefined, 6.5],
    ]);
    expect(data.points[1]?.label).toMatch(/^26 Sep/);
    expect(data.skills.map((s) => s.label)).toEqual(["Coding", "Resume", "Written intro"]);
    expect(data.hasChart).toBe(true);
  });

  it("only lists skills that have scores, and needs at least 2 scores for a chart", () => {
    const one = progressChartData([entry("c1", "coding", 4, "2026-09-25T00:00:00Z")]);
    expect(one).toMatchObject({ hasChart: false, skills: [{ type: "coding", label: "Coding" }] });
    expect(progressChartData(undefined)).toEqual({ points: [], skills: [], hasChart: false });
  });

  it("gives screen-reader rows of date, skill and score", () => {
    expect(progressRows(progressChartData(recent)).map(({ skill, score }) => `${skill} ${score}`)).toEqual([
      "Resume 7.0",
      "Coding 10.0",
      "Written intro 6.5",
    ]);
  });
});

describe("ProgressChart", () => {
  it("renders the empty state below 2 scores", () => {
    const html = renderToStaticMarkup(<ProgressChart recentScores={recent.slice(0, 1)} />);
    expect(html).toContain("appears after you have scores on at least two tasks");
    expect(html).not.toContain("<table");
  });

  it("renders a hidden chart container plus an accessible table of every score", () => {
    const html = renderToStaticMarkup(<ProgressChart recentScores={recent} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<table class="sr-only">');
    expect(html).toContain("<td>Written intro</td><td>6.5</td>");
    expect(html).toContain("last 3 tasks");
  });
});
