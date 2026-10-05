import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/me/route";
import { fakeAdmin, requestWithToken } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

type Body = { profile?: Record<string, unknown>; error?: string };

async function callMe(token: string | undefined): Promise<{ status: number; body: Body }> {
  const response = await POST(requestWithToken(token, "http://localhost/api/me"));
  return { status: response.status, body: (await response.json()) as Body };
}

beforeEach(() => {
  fakeAdmin.tokens.clear();
  fakeAdmin.users.clear();
  fakeAdmin.tokens.set("stu", { uid: "s1", email: "stu@college.ac.in", email_verified: true, name: "Stu" });
  fakeAdmin.tokens.set("ansh", { uid: "m1", email: "Ansh@college.ac.in", email_verified: true, name: "Ansh" });
  fakeAdmin.tokens.set("boss", { uid: "v1", email: "boss@college.ac.in", email_verified: true, name: "Boss" });
  fakeAdmin.tokens.set("gmail", { uid: "g1", email: "someone@gmail.com", email_verified: true });
});

describe("POST /api/me", () => {
  it("creates a student on first login, not onboarded and waiting for approval (T48)", async () => {
    const { status, body } = await callMe("stu");
    expect(status).toBe(200);
    expect(body.profile).toEqual({
      uid: "s1",
      name: "Stu",
      email: "stu@college.ac.in",
      role: "student",
      onboarded: false,
      showOnLeaderboard: false,
      pendingApproval: true,
    });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ role: "student", onboarded: false, pendingApproval: true });
    expect(fakeAdmin.users.get("s1")).toHaveProperty("createdAt");
  });

  it("creates mentors and viewers from the env lists, already onboarded", async () => {
    expect((await callMe("ansh")).body.profile).toMatchObject({ role: "mentor", onboarded: true });
    expect((await callMe("boss")).body.profile).toMatchObject({ role: "viewer", onboarded: true });
  });

  it("never makes staff wait for approval (T48)", async () => {
    expect((await callMe("ansh")).body.profile).not.toHaveProperty("pendingApproval");
    expect((await callMe("boss")).body.profile).not.toHaveProperty("pendingApproval");
  });

  it("keeps a pending student pending on later logins, and returns the profile so the app can show the waiting page", async () => {
    await callMe("stu");
    const { status, body } = await callMe("stu");
    expect(status).toBe(200);
    expect(body.profile).toMatchObject({ pendingApproval: true });
  });

  it("returns the existing profile on later logins without changing it", async () => {
    await callMe("stu");
    fakeAdmin.users.set("s1", { ...fakeAdmin.users.get("s1"), rollNo: "0827CS1", branch: "CSE", onboarded: true });
    const { body } = await callMe("stu");
    expect(body.profile).toMatchObject({ role: "student", rollNo: "0827CS1", branch: "CSE", onboarded: true });
  });

  it("upgrades an existing student whose email was later added to MENTOR_EMAILS", async () => {
    fakeAdmin.users.set("m1", {
      name: "Ansh",
      email: "ansh@college.ac.in",
      role: "student",
      onboarded: false,
      showOnLeaderboard: false,
    });
    const { body } = await callMe("ansh");
    expect(body.profile).toMatchObject({ role: "mentor", onboarded: true });
    expect(fakeAdmin.users.get("m1")).toMatchObject({ role: "mentor", onboarded: true });
  });

  it("demotes a mentor or viewer whose email is on neither list any more (T43)", async () => {
    for (const role of ["mentor", "viewer"]) {
      // stu@college.ac.in is on neither list in fakeEnv.
      fakeAdmin.users.set("s1", { name: "Stu", email: "stu@college.ac.in", role, onboarded: true, showOnLeaderboard: false });
      const { status, body } = await callMe("stu");
      expect(status).toBe(200);
      expect(body.profile).toMatchObject({ role: "student", onboarded: false }); // no roll number yet → onboarding
      expect(fakeAdmin.users.get("s1")).toMatchObject({ role: "student", onboarded: false, name: "Stu" });
    }
  });

  it("keeps a demoted former student's roll number and onboarding (T43)", async () => {
    fakeAdmin.users.set("s1", {
      name: "Stu",
      email: "stu@college.ac.in",
      role: "mentor",
      rollNo: "0827CS1",
      branch: "CSE",
      onboarded: true,
      showOnLeaderboard: false,
    });
    const { body } = await callMe("stu");
    expect(body.profile).toMatchObject({ role: "student", rollNo: "0827CS1", branch: "CSE", onboarded: true });
  });

  it("makes a viewer a mentor once their email is on MENTOR_EMAILS (T43)", async () => {
    fakeAdmin.users.set("m1", { name: "Ansh", email: "ansh@college.ac.in", role: "viewer", onboarded: true, showOnLeaderboard: false });
    expect((await callMe("ansh")).body.profile).toMatchObject({ role: "mentor" });
  });

  it("leaves a removed staff account removed and unchanged (T43)", async () => {
    const removed = { name: "Stu", email: "stu@college.ac.in", role: "mentor", onboarded: true, showOnLeaderboard: false, removed: true };
    fakeAdmin.users.set("s1", removed);
    expect((await callMe("stu")).status).toBe(403);
    expect(fakeAdmin.users.get("s1")).toEqual(removed);
  });

  it("403s a wrong-domain email with the college-email message and creates nothing", async () => {
    const { status, body } = await callMe("gmail");
    expect(status).toBe(403);
    expect(body).toEqual({ error: "Please sign in with your college email." });
    expect(fakeAdmin.users.size).toBe(0);
  });

  it("401s without a token", async () => {
    expect((await callMe(undefined)).status).toBe(401);
  });

  it("ignores any role the client tries to send in the body", async () => {
    const request = new Request("http://localhost/api/me", {
      method: "POST",
      headers: { authorization: "Bearer stu", "content-type": "application/json" },
      body: JSON.stringify({ role: "mentor" }),
    });
    const body = (await (await POST(request)).json()) as Body;
    expect(body.profile).toMatchObject({ role: "student" });
  });
});
