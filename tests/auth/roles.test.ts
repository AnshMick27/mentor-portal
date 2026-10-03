import { describe, expect, it } from "vitest";
import { decideRole, isAllowedEmail, planProvision } from "@/lib/auth/roles";
import type { StoredUser } from "@/lib/validation/user";

const mentors = new Set(["ansh@college.ac.in"]);
const viewers = new Set(["boss@college.ac.in", "ansh@college.ac.in"]);
const identity = { uid: "u1", email: "Stu@College.ac.in", name: "Stu" };

describe("decideRole", () => {
  it("makes emails in MENTOR_EMAILS mentors, case-insensitively", () => {
    expect(decideRole(" Ansh@College.AC.in ", mentors, viewers)).toBe("mentor");
  });

  it("makes emails in VIEWER_EMAILS viewers", () => {
    expect(decideRole("boss@college.ac.in", mentors, viewers)).toBe("viewer");
  });

  it("prefers mentor when an email is in both lists", () => {
    expect(decideRole("ansh@college.ac.in", mentors, viewers)).toBe("mentor");
  });

  it("makes everyone else a student", () => {
    expect(decideRole("someone@college.ac.in", mentors, viewers)).toBe("student");
    expect(decideRole("someone@college.ac.in", new Set(), new Set())).toBe("student");
  });
});

describe("isAllowedEmail", () => {
  it("accepts the exact domain, ignoring case and spaces", () => {
    expect(isAllowedEmail("a@college.ac.in", "college.ac.in")).toBe(true);
    expect(isAllowedEmail(" A@College.AC.IN ", "College.ac.in")).toBe(true);
  });

  it("rejects other domains, subdomains and look-alikes", () => {
    expect(isAllowedEmail("a@gmail.com", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("a@mail.college.ac.in", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("a@evilcollege.ac.in", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("a@college.ac.in.evil.com", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("college.ac.in@gmail.com", "college.ac.in")).toBe(false);
  });

  it("rejects malformed emails", () => {
    expect(isAllowedEmail("", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("@college.ac.in", "college.ac.in")).toBe(false);
    expect(isAllowedEmail("college.ac.in", "college.ac.in")).toBe(false);
  });
});

describe("planProvision", () => {
  const student: StoredUser = {
    name: "Stu",
    email: "stu@college.ac.in",
    role: "student",
    rollNo: "0827CS1",
    branch: "CSE",
    onboarded: true,
    showOnLeaderboard: false,
  };

  it("creates a new student with onboarded false and a lowercase email", () => {
    expect(planProvision(undefined, identity, "student")).toEqual({
      action: "create",
      user: { name: "Stu", email: "stu@college.ac.in", role: "student", onboarded: false, showOnLeaderboard: false },
    });
  });

  it("creates new mentors and viewers already onboarded", () => {
    for (const role of ["mentor", "viewer"] as const) {
      const plan = planProvision(undefined, identity, role);
      expect(plan.action).toBe("create");
      expect(plan.user.role).toBe(role);
      expect(plan.user.onboarded).toBe(true);
    }
  });

  it("upgrades an existing student whose email was added to MENTOR_EMAILS", () => {
    expect(planProvision(student, identity, "mentor")).toEqual({
      action: "update",
      changes: { role: "mentor", onboarded: true },
      user: { ...student, role: "mentor", onboarded: true },
    });
  });

  it("upgrades a viewer who became a mentor", () => {
    const plan = planProvision({ ...student, role: "viewer" }, identity, "mentor");
    expect(plan.action).toBe("update");
    expect(plan.user.role).toBe("mentor");
  });

  it("changes nothing when the role already matches", () => {
    expect(planProvision(student, identity, "student")).toEqual({ action: "none", user: student });
  });

  it("demotes a mentor or viewer who is on neither list any more (T43)", () => {
    for (const role of ["mentor", "viewer"] as const) {
      // Was a student before (has roll number and branch): straight back to the student home.
      expect(planProvision({ ...student, role }, identity, "student")).toEqual({
        action: "update",
        changes: { role: "student", onboarded: true },
        user: { ...student, role: "student", onboarded: true },
      });
    }
  });

  it("sends a demoted staff account with no roll number through onboarding (T43)", () => {
    const staff: StoredUser = { name: "Ann", email: "ann@college.ac.in", role: "mentor", onboarded: true, showOnLeaderboard: false };
    expect(planProvision(staff, identity, "student")).toEqual({
      action: "update",
      changes: { role: "student", onboarded: false },
      user: { ...staff, role: "student", onboarded: false },
    });
  });

  it("moves a mentor who is now only on VIEWER_EMAILS down to viewer (T43)", () => {
    const plan = planProvision({ ...student, role: "mentor" }, identity, "viewer");
    expect(plan).toMatchObject({ action: "update", changes: { role: "viewer", onboarded: true } });
  });

  it("never changes name or email on a later login", () => {
    const plan = planProvision({ ...student, role: "mentor" }, { ...identity, name: "New Name", email: "NEW@college.ac.in" }, "student");
    expect(plan.user).toMatchObject({ name: "Stu", email: "stu@college.ac.in" });
  });
});
