import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser, verifyIdentity } from "@/lib/auth/requireUser";
import { fakeAdmin, requestWithToken } from "./fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("./fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("./fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

const student = {
  name: "Stu",
  email: "stu@college.ac.in",
  role: "student",
  rollNo: "0827CS1",
  branch: "CSE",
  onboarded: true,
  showOnLeaderboard: false,
  createdAt: "ignored",
};

async function errorOf(response: Response): Promise<{ status: number; error: string }> {
  const body = (await response.json()) as { error: string };
  return { status: response.status, error: body.error };
}

beforeEach(() => {
  fakeAdmin.tokens.clear();
  fakeAdmin.users.clear();
  fakeAdmin.tokens.set("stu-token", { uid: "stu", email: "Stu@College.ac.in", email_verified: true, name: "Stu" });
  fakeAdmin.tokens.set("mentor-token", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("gmail-token", { uid: "g1", email: "x@gmail.com", email_verified: true });
  fakeAdmin.tokens.set("unverified-token", { uid: "u1", email: "u@college.ac.in", email_verified: false });
  fakeAdmin.tokens.set("no-email-token", { uid: "n1", email_verified: true });
  fakeAdmin.users.set("stu", student);
});

describe("verifyIdentity", () => {
  it("returns uid, lowercase email and name for a valid college token", async () => {
    const result = await verifyIdentity(requestWithToken("stu-token"));
    expect(result).toEqual({ ok: true, value: { uid: "stu", email: "stu@college.ac.in", name: "Stu" } });
  });

  it("falls back to the email's local part when the token has no name", async () => {
    const result = await verifyIdentity(requestWithToken("mentor-token"));
    expect(result.ok && result.value.name).toBe("ansh");
  });

  it("401s without an Authorization header or with a malformed one", async () => {
    for (const request of [
      requestWithToken(undefined),
      new Request("http://localhost/x", { headers: { authorization: "Basic abc" } }),
    ]) {
      const result = await verifyIdentity(request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect((await errorOf(result.response)).status).toBe(401);
    }
  });

  it("401s when the Admin SDK rejects the token", async () => {
    const result = await verifyIdentity(requestWithToken("forged"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect((await errorOf(result.response)).status).toBe(401);
  });

  it("403s with the college-email message for other domains, unverified or missing emails", async () => {
    for (const token of ["gmail-token", "unverified-token", "no-email-token"]) {
      const result = await verifyIdentity(requestWithToken(token));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(await errorOf(result.response)).toEqual({
          status: 403,
          error: "Please sign in with your college email.",
        });
      }
    }
  });
});

describe("requireUser", () => {
  it("returns the typed profile (role from Firestore) when the role is allowed", async () => {
    const result = await requireUser(requestWithToken("stu-token"), ["student"]);
    expect(result).toEqual({
      ok: true,
      value: {
        uid: "stu",
        name: "Stu",
        email: "stu@college.ac.in",
        role: "student",
        rollNo: "0827CS1",
        branch: "CSE",
        onboarded: true,
        showOnLeaderboard: false,
      },
    });
  });

  it("403s when the user's role is not allowed", async () => {
    const result = await requireUser(requestWithToken("stu-token"), ["mentor", "viewer"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect((await errorOf(result.response)).status).toBe(403);
  });

  it("uses the Firestore role, not the MENTOR_EMAILS list, until /api/me re-provisions", async () => {
    fakeAdmin.users.set("m1", { ...student, email: "ansh@college.ac.in", role: "student" });
    const result = await requireUser(requestWithToken("mentor-token"), ["mentor"]);
    expect(result.ok).toBe(false);
  });

  it("403s when the user doc does not exist yet", async () => {
    const result = await requireUser(requestWithToken("mentor-token"), ["mentor"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect((await errorOf(result.response)).status).toBe(403);
  });

  it("500s without leaking data when the user doc is malformed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeAdmin.users.set("stu", { ...student, role: "admin" });
    const result = await requireUser(requestWithToken("stu-token"), ["student"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect((await errorOf(result.response)).status).toBe(500);
  });

  it("rejects wrong-domain tokens before reading Firestore", async () => {
    const result = await requireUser(requestWithToken("gmail-token"), ["student", "mentor", "viewer"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect((await errorOf(result.response)).status).toBe(403);
  });
});
