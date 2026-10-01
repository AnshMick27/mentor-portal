import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardTable, Switch } from "@/components/leaderboard/LeaderboardParts";
import { LeaderboardSetting, LeaderboardSettingView } from "@/components/mentor/LeaderboardSetting";
import { LeaderboardSection, StudentLeaderboard } from "@/components/student/StudentLeaderboard";
import { configView, leaderboardView } from "@/lib/leaderboard/view";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ getIdToken: async () => "token", refreshProfile: async () => undefined }),
  useSignedInProfile: () => ({ uid: "s1", name: "Asha", role: "student", onboarded: true, showOnLeaderboard: true, email: "a@x" }),
}));

const entries = [
  { rank: 1, name: "Bela", overallAvg: 9 },
  { rank: 2, name: "Arjun", overallAvg: 8 },
  { rank: 2, name: "Chetan", overallAvg: 8 },
];

describe("leaderboardView / configView", () => {
  it("treats a 404 as 'off', other failures as errors, and validates the reply", () => {
    expect(leaderboardView({ ok: false, status: 404, message: "Leaderboard is off." })).toEqual({ status: "off" });
    expect(leaderboardView({ ok: false, status: 500, message: "Boom" })).toEqual({ status: "error", message: "Boom" });
    expect(leaderboardView({ ok: true, data: { entries } })).toEqual({ status: "ready", entries });
    // An entry carrying anything beyond rank/name/average is refused, not shown.
    const leaky = { entries: [{ ...entries[0], uid: "s2" }] };
    expect(leaderboardView({ ok: true, data: leaky }).status).toBe("error");
  });

  it("reads the mentor setting", () => {
    expect(configView({ ok: true, data: { config: { leaderboardEnabled: true } } })).toEqual({
      status: "ready",
      leaderboardEnabled: true,
    });
    expect(configView({ ok: true, data: {} }).status).toBe("error");
    expect(configView({ ok: false, status: 403, message: "No" })).toEqual({ status: "error", message: "No" });
  });
});

describe("LeaderboardTable and Switch", () => {
  it("shows rank, name and average (shared ranks), or an empty message", () => {
    const html = renderToStaticMarkup(<LeaderboardTable entries={entries} />);
    expect(html.match(/<tr /g)).toHaveLength(4); // header + 3 rows
    expect(html).toContain("Chetan</td><td");
    expect(html).toContain(">8.0<");
    expect(renderToStaticMarkup(<LeaderboardTable entries={[]} />)).toContain("Nobody is on the leaderboard yet.");
  });

  it("renders an accessible, labelled switch with its hint and error", () => {
    const html = renderToStaticMarkup(
      <Switch id="x" label="Show me" hint="Only name and average." checked error="Could not save." onChange={() => undefined} />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('for="x"');
    expect(html).toContain('aria-describedby="x-hint"');
    expect(html).toContain("Could not save.");
  });
});

describe("student leaderboard section", () => {
  const render = (props: Parameters<typeof LeaderboardSection>[0]) => renderToStaticMarkup(<LeaderboardSection {...props} />);
  const base = { optedIn: false, saving: false, onToggle: () => undefined };

  it("shows the table only while the leaderboard is on; the opt-in switch always", () => {
    const on = render({ ...base, view: { status: "ready", entries } });
    expect(on).toContain("<table");
    expect(on).toContain("Show me on the leaderboard");
    const off = render({ ...base, view: { status: "off" } });
    expect(off).not.toContain("<table");
    expect(off).toContain("switched off right now");
    expect(off).toContain("Show me on the leaderboard");
    expect(off).toContain("Only your name and average are shown");
  });

  it("reflects the opt-in and disables the switch while saving", () => {
    const html = render({ ...base, optedIn: true, saving: true, view: { status: "loading" } });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("disabled");
  });

  it("starts loading with the switch set from the profile", () => {
    const html = renderToStaticMarkup(<StudentLeaderboard />);
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("<table");
  });
});

describe("mentor leaderboard setting", () => {
  const render = (props: Parameters<typeof LeaderboardSettingView>[0]) =>
    renderToStaticMarkup(<LeaderboardSettingView {...props} />);

  it("shows the current state and disables the switch while loading or saving", () => {
    // The label stays the same; the switch itself says on or off (UX-32).
    const on = render({ view: { status: "ready", leaderboardEnabled: true }, saving: false, onToggle: () => undefined });
    expect(on).toContain("Show the leaderboard to students");
    expect(on).toContain('aria-checked="true"');
    const loading = render({ view: { status: "loading" }, saving: false, onToggle: () => undefined });
    expect(loading).toContain("Show the leaderboard to students");
    expect(loading).toContain('aria-checked="false"');
    expect(loading).toContain("disabled");
    expect(render({ view: { status: "error", message: "Could not load." }, saving: false, onToggle: () => undefined })).toContain(
      "Could not load.",
    );
    expect(renderToStaticMarkup(<LeaderboardSetting />)).toContain("Student leaderboard");
  });
});
