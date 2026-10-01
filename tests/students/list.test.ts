import { describe, expect, it } from "vitest";
import { searchStudents, splitStudents, toStudentRow, type StudentRow } from "@/lib/students/list";

const joined = new Date("2026-09-25T04:00:00Z");
const base = { email: "a@college.ac.in", role: "student", onboarded: true, showOnLeaderboard: false };

describe("toStudentRow", () => {
  it("maps a student doc, including the joined date and the removed flag", () => {
    expect(
      toStudentRow("s1", { ...base, name: "Asha", rollNo: "0827CS1", branch: "CSE", removed: true, createdAt: { toDate: () => joined } }),
    ).toEqual({ uid: "s1", name: "Asha", email: "a@college.ac.in", rollNo: "0827CS1", branch: "CSE", onboarded: true, removed: true, joinedAt: joined });
  });

  it("treats a missing removed flag as active and keeps not-onboarded sign-ups", () => {
    expect(toStudentRow("s2", { ...base, name: "New", onboarded: false })).toEqual({
      uid: "s2",
      name: "New",
      email: "a@college.ac.in",
      onboarded: false,
      removed: false,
    });
  });

  it("skips staff and malformed docs", () => {
    expect(toStudentRow("m1", { ...base, name: "M", role: "mentor" })).toBeUndefined();
    expect(toStudentRow("x", { name: 1 })).toBeUndefined();
  });
});

describe("searchStudents and splitStudents", () => {
  const row = (uid: string, name: string, extra: Partial<StudentRow> = {}): StudentRow => ({
    uid,
    name,
    email: `${uid}@college.ac.in`,
    onboarded: true,
    removed: false,
    ...extra,
  });
  const rows = [row("s3", "Zara", { rollNo: "0827EC9" }), row("s1", "asha"), row("s2", "Bela", { removed: true })];

  it("searches name, email and roll number, ignoring case; blank keeps all", () => {
    expect(searchStudents(rows, "ZAR").map((r) => r.uid)).toEqual(["s3"]);
    expect(searchStudents(rows, "s2@college").map((r) => r.uid)).toEqual(["s2"]);
    expect(searchStudents(rows, "ec9").map((r) => r.uid)).toEqual(["s3"]);
    expect(searchStudents(rows, "   ")).toHaveLength(3);
  });

  it("splits active and removed, each by name", () => {
    const { active, removed } = splitStudents(rows);
    expect(active.map((r) => r.name)).toEqual(["asha", "Zara"]);
    expect(removed.map((r) => r.name)).toEqual(["Bela"]);
  });
});
