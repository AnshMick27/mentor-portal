import ExcelJS from "exceljs";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportGet } from "@/app/api/export/route";
import { POST as feedbackPost } from "@/app/api/feedback/route";
import { POST as onboardingPost } from "@/app/api/onboarding/route";
import { POST as approvePost } from "@/app/api/students/[uid]/approve/route";
import { POST as removePost } from "@/app/api/students/[uid]/remove/route";
import { POST as restorePost } from "@/app/api/students/[uid]/restore/route";
import { PENDING_MESSAGE } from "@/lib/api/errors";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});
vi.mock("@/lib/ai/provider", () => ({ generateFeedback: vi.fn() }));

const past = Timestamp.fromDate(new Date("2026-09-20T18:29:00Z"));

function post(token?: string, body?: unknown): Request {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/x", { method: "POST", headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const ctx = (uid: string) => ({ params: Promise.resolve({ uid }) });
type Handler = (request: Request, context: ReturnType<typeof ctx>) => Promise<Response>;
async function call(handler: Handler, token: string | undefined, uid: string) {
  const response = await handler(post(token), ctx(uid));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
const approve = (token: string | undefined, uid: string) => call(approvePost, token, uid);

function student(uid: string, fields: Record<string, unknown> = {}) {
  fakeAdmin.tokens.set(uid, { uid, email: `${uid}@college.ac.in`, email_verified: true, name: uid });
  fakeAdmin.users.set(uid, {
    name: uid,
    email: `${uid}@college.ac.in`,
    role: "student",
    onboarded: true,
    rollNo: `ROLL-${uid}`,
    branch: "CSE",
    showOnLeaderboard: false,
    ...fields,
  });
}

beforeEach(() => {
  fakeAdmin.reset();
  const staff = (role: string) => ({ name: role, email: `${role}@college.ac.in`, role, onboarded: true, showOnLeaderboard: false });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.users.set("m1", staff("mentor"));
  fakeAdmin.users.set("v1", staff("viewer"));
  student("old"); // signed up before T48: no field, approved
  student("new", { pendingApproval: true });
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
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/students/[uid]/approve — who may approve (T48)", () => {
  it("401 without a token; 403 for viewers and students; nothing changes", async () => {
    expect((await approve(undefined, "new")).status).toBe(401);
    expect((await approve("viewer", "new")).status).toBe(403);
    expect((await approve("old", "new")).status).toBe(403);
    expect(fakeAdmin.users.get("new")).toMatchObject({ pendingApproval: true });
  });

  it("400 for staff accounts, 404 for unknown or malformed ids", async () => {
    expect((await approve("mentor", "v1")).status).toBe(400);
    expect((await approve("mentor", "nobody")).status).toBe(404);
    expect((await approve("mentor", "a/b")).status).toBe(404);
  });
});

describe("approving (T48)", () => {
  it("lets the student in: field removed, who and when recorded, stats created", async () => {
    const { status, body } = await approve("mentor", "new");
    expect(status).toBe(200);
    expect(body).toEqual({ student: { uid: "new", pendingApproval: false } });
    const user = fakeAdmin.users.get("new") as Record<string, unknown>;
    expect(user).not.toHaveProperty("pendingApproval");
    expect(user).toMatchObject({ approvedBy: "m1" });
    expect(user.approvedAt).toBeInstanceOf(Timestamp);
    expect(fakeAdmin.collection("studentStats").get("new")).toBeDefined();
    expect((fakeAdmin.collection("taskStats").get("t1") as { notSubmittedUids: string[] }).notSubmittedUids).toContain("new");
  });

  it("changes nothing for a student who is already approved", async () => {
    expect((await approve("mentor", "old")).status).toBe(200);
    expect(fakeAdmin.users.get("old")).not.toHaveProperty("approvedBy");
  });

  it("leaves a removed student removed; restoring a never-approved student keeps them pending", async () => {
    await call(removePost, "mentor", "new");
    await call(restorePost, "mentor", "new");
    expect(fakeAdmin.users.get("new")).toMatchObject({ pendingApproval: true, removed: false });
    await call(removePost, "mentor", "new");
    await approve("mentor", "new");
    expect(fakeAdmin.users.get("new")).toMatchObject({ removed: true });
  });
});

describe("a student waiting for approval (T48)", () => {
  it("is refused on student routes with a plain message", async () => {
    const response = await feedbackPost(post("new", { taskId: "t1", type: "resume", content: "My resume text." }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: PENDING_MESSAGE });
  });

  it("can still onboard, but gets no stats doc until approved", async () => {
    student("fresh", { onboarded: false, rollNo: undefined, branch: undefined, pendingApproval: true });
    const response = await onboardingPost(post("fresh", { rollNo: "0827CS231001", branch: "CSE" }));
    expect(response.status).toBe(200);
    expect(fakeAdmin.users.get("fresh")).toMatchObject({ onboarded: true, pendingApproval: true });
    expect(fakeAdmin.collection("studentStats").get("fresh")).toBeUndefined();
  });

  it("is left out of task stats and the export until approved", async () => {
    await approve("mentor", "old"); // runs a full recompute
    expect((fakeAdmin.collection("taskStats").get("t1") as { notSubmittedUids: string[] }).notSubmittedUids).toEqual(["old"]);
    expect(fakeAdmin.collection("studentStats").get("new")).toBeUndefined();

    const response = await exportGet(new Request("http://localhost/api/export", { headers: { authorization: "Bearer mentor" } }));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    const names: string[] = [];
    book.getWorksheet("Students")?.eachRow((row) => names.push(String(row.getCell(1).value)));
    expect(names).toEqual(["Name", "old"]);
  });
});
