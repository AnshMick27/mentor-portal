import { describe, expect, it } from "vitest";
import { guardRedirect, homeFor, type AuthView, type GuardArea } from "@/lib/auth/guards";
import type { UserProfile } from "@/lib/validation/user";

const base: UserProfile = {
  uid: "u1",
  name: "User",
  email: "u@college.ac.in",
  role: "student",
  onboarded: true,
  showOnLeaderboard: false,
};

const signedIn = (profile: Partial<UserProfile>): AuthView => ({ status: "signedIn", profile: { ...base, ...profile } });
const newStudent = signedIn({ onboarded: false });
const student = signedIn({ rollNo: "0827CS1", branch: "CSE" });
const mentor = signedIn({ role: "mentor" });
const viewer = signedIn({ role: "viewer" });
const AREAS: GuardArea[] = ["student", "mentor", "onboarding", "login", "home"];

describe("homeFor", () => {
  it("sends staff to /mentor and students to /student or /onboarding", () => {
    expect(homeFor({ ...base, role: "mentor" })).toBe("/mentor");
    expect(homeFor({ ...base, role: "viewer" })).toBe("/mentor");
    expect(homeFor(base)).toBe("/student");
    expect(homeFor({ ...base, onboarded: false })).toBe("/onboarding");
  });
});

describe("guardRedirect", () => {
  it("waits (no redirect) while auth is loading", () => {
    for (const area of AREAS) expect(guardRedirect(area, { status: "loading" })).toBeNull();
  });

  it("sends signed-out users to /login from every protected area", () => {
    for (const area of ["student", "mentor", "onboarding"] as const) {
      expect(guardRedirect(area, { status: "signedOut" })).toBe("/login");
    }
    expect(guardRedirect("login", { status: "signedOut" })).toBeNull();
  });

  it("lets onboarded students into /student only", () => {
    expect(guardRedirect("student", student)).toBeNull();
    expect(guardRedirect("mentor", student)).toBe("/student");
    expect(guardRedirect("onboarding", student)).toBe("/student");
  });

  it("sends students who have not onboarded to /onboarding", () => {
    expect(guardRedirect("student", newStudent)).toBe("/onboarding");
    expect(guardRedirect("mentor", newStudent)).toBe("/onboarding");
    expect(guardRedirect("onboarding", newStudent)).toBeNull();
  });

  it("lets mentors and viewers into /mentor only", () => {
    for (const staff of [mentor, viewer]) {
      expect(guardRedirect("mentor", staff)).toBeNull();
      expect(guardRedirect("student", staff)).toBe("/mentor");
      expect(guardRedirect("onboarding", staff)).toBe("/mentor");
    }
  });

  it("moves signed-in users away from /login to their home", () => {
    expect(guardRedirect("login", student)).toBe("/student");
    expect(guardRedirect("login", newStudent)).toBe("/onboarding");
    expect(guardRedirect("login", viewer)).toBe("/mentor");
  });

  it("keeps the landing page public but sends signed-in users to their home (T41)", () => {
    expect(guardRedirect("home", { status: "loading" })).toBeNull();
    expect(guardRedirect("home", { status: "signedOut" })).toBeNull();
    expect(guardRedirect("home", student)).toBe("/student");
    expect(guardRedirect("home", newStudent)).toBe("/onboarding");
    expect(guardRedirect("home", mentor)).toBe("/mentor");
    expect(guardRedirect("home", viewer)).toBe("/mentor");
  });
});
