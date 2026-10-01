import ExcelJS from "exceljs";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as leaderboardGet } from "@/app/api/leaderboard/route";
import { POST as me } from "@/app/api/me/route";
import { POST as removePost } from "@/app/api/students/[uid]/remove/route";
import { POST as restorePost } from "@/app/api/students/[uid]/restore/route";
import { REMOVED_MESSAGE } from "@/lib/api/errors";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

const past = Timestamp.fromDate(new Date("2026-09-20T18:29:00Z"));

function request(token?: string): Request {
  return new Request("http://localhost/api/x", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
}
const ctx = (uid: string) => ({ params: Promise.resolve({ uid }) });
type Handler = (request: Request, context: ReturnType<typeof ctx>) => Promise<Response>;
async function call(handler: Handler, token: string | undefined, uid: string) {
  const response = await handler(request(token), ctx(uid));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
const remove = (token: string | undefined, uid: string) => call(removePost, token, uid);
const restore = (token: string | undefined, uid: string) => call(restorePost, token, uid);

function student(uid: string, name: string) {
  fakeAdmin.tokens.set(uid, { uid, email: `${uid}@college.ac.in`, email_verified: true, name });
  fakeAdmin.users.set(uid, {
    name,
    email: `${uid}@college.ac.in`,
    role: "student",
    onboarded: true,
    rollNo: `ROLL-${uid}`,
    branch: "CSE",
    showOnLeaderboard: true,
  });
}

beforeEach(() => {
  fakeAdmin.reset();
  const staff = (role: string) => ({ name: role, email: `${role}@college.ac.in`, role, onboarded: true, showOnLeaderboard: false });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.users.set("m1", staff("mentor"));
  fakeAdmin.users.set("v1", staff("viewer"));
  student("s1", "Outsider Ravi");
  student("s2", "Mentee Asha");
  fakeAdmin.collection("tasks").set("t1", {
    title: "Resume review",
    type: "resume",
    description: "d",
    dueAt: past,
    status: "published",
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: past,
    updatedAt: past,
  });
  fakeAdmin.collection("submissions").set("sub1", {
    taskId: "t1",
    uid: "s1",
    type: "resume",
    attempt: 1,
    createdAt: Timestamp.fromDate(new Date("2026-09-19T10:00:00Z")),
    status: "done",
    content: "text",
    result: { score: 9, summary: "Great.", strengths: [], improvements: [], nextSteps: [] },
  });
  fakeAdmin.collection("config").set("app", { leaderboardEnabled: true });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("who may remove or restore", () => {
  it("401 without a token; 403 for viewers and students", async () => {
    expect((await remove(undefined, "s1")).status).toBe(401);
    expect((await remove("viewer", "s1")).status).toBe(403);
    expect((await restore("viewer", "s1")).status).toBe(403);
    expect((await remove("s2", "s1")).status).toBe(403);
    expect(fakeAdmin.users.get("s1")?.removed).toBeUndefined();
  });

  it("refuses staff accounts, unknown users and malformed ids", async () => {
    expect(await remove("mentor", "v1")).toEqual({ status: 400, body: { error: "Only student accounts can be removed or restored." } });
    expect((await remove("mentor", "m1")).status).toBe(400);
    expect((await remove("mentor", "nobody")).status).toBe(404);
    expect((await remove("mentor", "../x")).status).toBe(404);
  });
});

describe("removing a student", () => {
  it("marks the user doc, keeps their data, and drops them from every stat", async () => {
    const before = await (await import("@/lib/stats/recompute")).recomputeAll();
    expect(before).toEqual({ students: 2, tasks: 1 });
    expect(fakeAdmin.collection("taskStats").get("t1")).toMatchObject({ submittedCount: 1, notSubmittedUids: ["s2"] });

    expect(await remove("mentor", "s1")).toEqual({ status: 200, body: { student: { uid: "s1", removed: true } } });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ removed: true, removedBy: "m1", name: "Outsider Ravi" });
    expect(fakeAdmin.collection("submissions").has("sub1")).toBe(true); // data kept
    expect(fakeAdmin.collection("studentStats").has("s1")).toBe(false);
    expect(fakeAdmin.collection("taskStats").get("t1")).toMatchObject({ submittedCount: 0, notSubmittedUids: ["s2"] });
    expect(fakeAdmin.collection("studentStats").has("s2")).toBe(true);
  });

  it("blocks them on every student route and at sign-in, without re-creating or changing their doc", async () => {
    await remove("mentor", "s1");
    const blocked = await leaderboardGet(request("s1"));
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: REMOVED_MESSAGE });
    const signIn = await me(request("s1"));
    expect(signIn.status).toBe(403);
    expect(await signIn.json()).toEqual({ error: REMOVED_MESSAGE });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ removed: true, role: "student" });
  });

  it("leaves them off the leaderboard and out of the export", async () => {
    await remove("mentor", "s1");
    const board = (await (await leaderboardGet(request("viewer"))).json()) as { entries: { name: string }[] };
    expect(board.entries.map((e) => e.name)).not.toContain("Outsider Ravi");

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await (await exportGet(request("viewer"))).arrayBuffer());
    const cells: string[] = [];
    for (const sheet of book.worksheets) sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
    expect(cells).toContain("Mentee Asha");
    expect(cells.join("|")).not.toContain("Outsider Ravi");
  });

  it("is harmless to repeat", async () => {
    expect((await remove("mentor", "s1")).status).toBe(200);
    expect((await remove("mentor", "s1")).status).toBe(200);
    expect(fakeAdmin.users.get("s1")).toMatchObject({ removed: true });
  });
});

describe("restoring a student", () => {
  it("gives access back and brings their stats back", async () => {
    await remove("mentor", "s1");
    expect(await restore("mentor", "s1")).toEqual({ status: 200, body: { student: { uid: "s1", removed: false } } });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ removed: false, restoredBy: "m1" });
    expect(fakeAdmin.collection("studentStats").get("s1")).toMatchObject({ tasksSubmitted: 1, overallAvg: 9 });
    expect(fakeAdmin.collection("taskStats").get("t1")).toMatchObject({ submittedCount: 1 });
    expect((await leaderboardGet(request("s1"))).status).toBe(200);
    expect((await me(request("s1"))).status).toBe(200);
  });
});
