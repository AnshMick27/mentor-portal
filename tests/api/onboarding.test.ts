import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/onboarding/route";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

type Body = { profile?: Record<string, unknown>; error?: string };

function newUser(role: "student" | "mentor" | "viewer", onboarded = role !== "student") {
  return { name: "Stu", email: "stu@college.ac.in", role, onboarded, showOnLeaderboard: false };
}

async function post(token: string | undefined, body: unknown): Promise<{ status: number; body: Body }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const request = new Request("http://localhost/api/onboarding", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Body };
}

const valid = { rollNo: " 0827cs221001 ", branch: "CSE" };

beforeEach(() => {
  fakeAdmin.reset();
  fakeAdmin.tokens.set("stu", { uid: "s1", email: "stu@college.ac.in", email_verified: true, name: "Stu" });
  fakeAdmin.tokens.set("other", { uid: "s2", email: "other@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.users.set("s1", newUser("student"));
  fakeAdmin.users.set("s2", newUser("student"));
  fakeAdmin.users.set("m1", newUser("mentor"));
  fakeAdmin.users.set("v1", newUser("viewer"));
});

describe("POST /api/onboarding", () => {
  it("saves the normalised roll number and branch, sets onboarded, and returns the profile", async () => {
    const { status, body } = await post("stu", valid);
    expect(status).toBe(200);
    expect(body.profile).toMatchObject({ uid: "s1", role: "student", rollNo: "0827CS221001", branch: "CSE", onboarded: true });
    expect(fakeAdmin.users.get("s1")).toMatchObject({ rollNo: "0827CS221001", branch: "CSE", onboarded: true, role: "student" });
  });

  it("creates the initial studentStats doc", async () => {
    await post("stu", valid);
    expect(fakeAdmin.collection("studentStats").get("s1")).toMatchObject({
      name: "Stu",
      rollNo: "0827CS221001",
      branch: "CSE",
      tasksDue: 0,
      tasksSubmitted: 0,
      missedCount: 0,
      needsAttention: false,
    });
    expect(fakeAdmin.collection("studentStats").get("s1")).toHaveProperty("updatedAt");
  });

  it("refuses mentors and viewers (student only)", async () => {
    expect((await post("mentor", valid)).status).toBe(403);
    expect((await post("viewer", valid)).status).toBe(403);
    expect(fakeAdmin.collection("studentStats").size).toBe(0);
  });

  it("401s without a token", async () => {
    expect((await post(undefined, valid)).status).toBe(401);
  });

  it("400s with the validation message for bad input and writes nothing", async () => {
    const bad = await post("stu", { rollNo: "12-34", branch: "CSE" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("Roll number");
    expect((await post("stu", { rollNo: "ABC123", branch: "MECH" })).status).toBe(400);
    expect((await post("stu", "not json")).status).toBe(400);
    expect(fakeAdmin.users.get("s1")).toMatchObject({ onboarded: false });
  });

  it("400s when the client tries to set extra fields like role", async () => {
    const { status } = await post("stu", { ...valid, role: "mentor" });
    expect(status).toBe(400);
    expect(fakeAdmin.users.get("s1")).toMatchObject({ role: "student", onboarded: false });
  });

  it("409s a second onboarding and keeps the first details", async () => {
    await post("stu", valid);
    const again = await post("stu", { rollNo: "ZZZ999", branch: "IT" });
    expect(again.status).toBe(409);
    expect(fakeAdmin.users.get("s1")).toMatchObject({ rollNo: "0827CS221001", branch: "CSE" });
  });

  it("409s a roll number another student already registered", async () => {
    await post("stu", valid);
    const { status, body } = await post("other", { rollNo: "0827CS221001", branch: "IT" });
    expect(status).toBe(409);
    expect(body.error).toContain("already registered");
    expect(fakeAdmin.users.get("s2")).toMatchObject({ onboarded: false });
  });
});
