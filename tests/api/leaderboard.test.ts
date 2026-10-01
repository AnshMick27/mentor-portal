import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getConfig, PATCH as patchConfig } from "@/app/api/config/route";
import { GET as getLeaderboard } from "@/app/api/leaderboard/route";
import { POST as optIn } from "@/app/api/me/leaderboard/route";
import { rankEntries } from "@/lib/leaderboard/rank";
import { leaderboardResponseSchema } from "@/lib/validation/config";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

function request(method: string, token: string | undefined, body?: unknown): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/x", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function read(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** An onboarded student with a stats doc; `avg` undefined = no finished task yet. */
function student(uid: string, name: string, avg: number | undefined, optedIn: boolean) {
  fakeAdmin.users.set(uid, {
    name,
    email: `${uid}@college.ac.in`,
    role: "student",
    onboarded: true,
    rollNo: `ROLL${uid.toUpperCase()}`,
    branch: "CSE",
    showOnLeaderboard: optedIn,
  });
  fakeAdmin.collection("studentStats").set(uid, {
    name,
    rollNo: `ROLL${uid.toUpperCase()}`,
    branch: "CSE",
    tasksDue: 1,
    tasksSubmitted: 1,
    missedCount: 0,
    avgBySkill: {},
    ...(avg === undefined ? {} : { overallAvg: avg }),
    recentScores: [],
    latestNextSteps: [],
    needsAttention: false,
    showOnLeaderboard: optedIn,
    updatedAt: { toDate: () => new Date(), toMillis: () => 0 },
  });
}

const enable = () => fakeAdmin.collection("config").set("app", { leaderboardEnabled: true });

beforeEach(() => {
  fakeAdmin.reset();
  const staff = (role: string) => ({ name: role, email: `${role}@college.ac.in`, role, onboarded: true, showOnLeaderboard: false });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("student", { uid: "s1", email: "s1@college.ac.in", email_verified: true });
  fakeAdmin.users.set("m1", staff("mentor"));
  fakeAdmin.users.set("v1", staff("viewer"));
  student("s1", "Asha", 7, false);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET/PATCH /api/config", () => {
  it("defaults to off when config/app is missing; mentor and viewer can read it, students cannot", async () => {
    expect(await read(await getConfig(request("GET", "mentor")))).toEqual({
      status: 200,
      body: { config: { leaderboardEnabled: false } },
    });
    expect((await getConfig(request("GET", "viewer"))).status).toBe(200);
    expect((await getConfig(request("GET", "student"))).status).toBe(403);
    expect((await getConfig(request("GET", undefined))).status).toBe(401);
  });

  it("lets only mentors switch the leaderboard", async () => {
    expect((await patchConfig(request("PATCH", "viewer", { leaderboardEnabled: true }))).status).toBe(403);
    expect((await patchConfig(request("PATCH", "student", { leaderboardEnabled: true }))).status).toBe(403);
    expect(fakeAdmin.collection("config").get("app")).toBeUndefined();
    const on = await read(await patchConfig(request("PATCH", "mentor", { leaderboardEnabled: true })));
    expect(on).toEqual({ status: 200, body: { config: { leaderboardEnabled: true } } });
    expect(fakeAdmin.collection("config").get("app")).toEqual({ leaderboardEnabled: true });
  });

  it("400s bodies that are not exactly { leaderboardEnabled: boolean }", async () => {
    for (const body of [{}, { leaderboardEnabled: "yes" }, { leaderboardEnabled: true, extra: 1 }]) {
      expect((await patchConfig(request("PATCH", "mentor", body))).status).toBe(400);
    }
  });
});

describe("POST /api/me/leaderboard", () => {
  it("sets the student's own opt-in on the user doc and the stats doc", async () => {
    const result = await read(await optIn(request("POST", "student", { showOnLeaderboard: true })));
    expect(result).toEqual({ status: 200, body: { showOnLeaderboard: true } });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ showOnLeaderboard: true });
    expect(fakeAdmin.collection("studentStats").get("s1")).toMatchObject({ showOnLeaderboard: true });
    await optIn(request("POST", "student", { showOnLeaderboard: false }));
    expect(fakeAdmin.users.get("s1")).toMatchObject({ showOnLeaderboard: false });
    expect(fakeAdmin.collection("studentStats").get("s1")).toMatchObject({ showOnLeaderboard: false });
  });

  it("works before the stats doc exists (only the user doc changes)", async () => {
    fakeAdmin.collection("studentStats").delete("s1");
    expect((await optIn(request("POST", "student", { showOnLeaderboard: true }))).status).toBe(200);
    expect(fakeAdmin.users.get("s1")).toMatchObject({ showOnLeaderboard: true });
    expect(fakeAdmin.collection("studentStats").has("s1")).toBe(false);
  });

  it("is student-only and refuses smuggled fields such as another uid", async () => {
    expect((await optIn(request("POST", "mentor", { showOnLeaderboard: true }))).status).toBe(403);
    expect((await optIn(request("POST", "student", { showOnLeaderboard: true, uid: "s2" }))).status).toBe(400);
    expect((await optIn(request("POST", "student", {}))).status).toBe(400);
  });
});

describe("GET /api/leaderboard", () => {
  it("404s while the leaderboard is off, for every role", async () => {
    for (const token of ["student", "mentor", "viewer"]) {
      expect(await read(await getLeaderboard(request("GET", token)))).toEqual({
        status: 404,
        body: { error: "Leaderboard is off." },
      });
    }
    expect((await getLeaderboard(request("GET", undefined))).status).toBe(401);
  });

  it("lists only opted-in students with an average, best first, ties by name with a shared rank", async () => {
    enable();
    student("s2", "Bela", 9, true);
    student("s3", "Chetan", 8, true);
    student("s4", "Arjun", 8, true); // ties with Chetan, sorts first by name
    student("s5", "Dev", 9.5, false); // not opted in
    student("s6", "Esha", undefined, true); // opted in, no average yet
    const { status, body } = await read(await getLeaderboard(request("GET", "student")));
    expect(status).toBe(200);
    expect(body.entries).toEqual([
      { rank: 1, name: "Bela", overallAvg: 9 },
      { rank: 2, name: "Arjun", overallAvg: 8 },
      { rank: 2, name: "Chetan", overallAvg: 8 },
    ]);
  });

  it("caps at 10 and returns only rank, name and average", async () => {
    enable();
    for (let i = 0; i < 12; i++) student(`x${i}`, `Student ${String(i).padStart(2, "0")}`, 5 + i * 0.1, true);
    const { body } = await read(await getLeaderboard(request("GET", "viewer")));
    const parsed = leaderboardResponseSchema.parse(body); // strict entries: any extra field fails
    expect(parsed.entries).toHaveLength(10);
    expect(parsed.entries[0]).toEqual({ rank: 1, name: "Student 11", overallAvg: 6.1 });
    const raw = JSON.stringify(body);
    for (const leak of ["uid", "email", "rollNo", "ROLL", "x11"]) expect(raw).not.toContain(leak);
  });
});

describe("rankEntries", () => {
  it("uses competition ranking and keeps the input order", () => {
    const rows = [
      { name: "A", overallAvg: 9 },
      { name: "B", overallAvg: 9 },
      { name: "C", overallAvg: 7 },
      { name: "D", overallAvg: 6 },
    ];
    expect(rankEntries(rows).map((e) => `${e.rank}${e.name}`)).toEqual(["1A", "1B", "3C", "4D"]);
    expect(rankEntries([])).toEqual([]);
  });
});
