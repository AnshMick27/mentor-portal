import { describe, expect, it } from "vitest";
import { onboardingSchema, ROLL_NO_MESSAGE } from "@/lib/validation/onboarding";
import { BRANCHES } from "@/lib/validation/user";

function firstError(input: unknown): string | undefined {
  const result = onboardingSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("onboardingSchema", () => {
  it("trims and uppercases the roll number", () => {
    expect(onboardingSchema.parse({ rollNo: "  0827cs221001 ", branch: "CSE" })).toEqual({
      rollNo: "0827CS221001",
      branch: "CSE",
    });
  });

  it("accepts roll numbers of exactly 6 and 15 characters", () => {
    expect(onboardingSchema.safeParse({ rollNo: "ABC123", branch: "IT" }).success).toBe(true);
    expect(onboardingSchema.safeParse({ rollNo: "A".repeat(15), branch: "IT" }).success).toBe(true);
  });

  it("rejects roll numbers that are too short, too long, or not alphanumeric", () => {
    for (const rollNo of ["", "ABC12", "A".repeat(16), "0827-CS-22", "0827 CS22", "0827CS22!", "०८२७CS22"]) {
      expect(firstError({ rollNo, branch: "CSE" }), rollNo).toBe(ROLL_NO_MESSAGE);
    }
  });

  it("rejects a missing or non-string roll number", () => {
    expect(firstError({ branch: "CSE" })).toBe(ROLL_NO_MESSAGE);
    expect(firstError({ rollNo: 12345678, branch: "CSE" })).toBe(ROLL_NO_MESSAGE);
  });

  it("accepts every branch in SPEC.md §6 and nothing else", () => {
    expect(BRANCHES).toEqual(["CSE", "IT", "CSIT", "CSE-AIML", "CY", "CSE-DS", "EC", "ME", "OTHER"]);
    for (const branch of BRANCHES) expect(onboardingSchema.safeParse({ rollNo: "ABC123", branch }).success).toBe(true);
    for (const branch of ["", "cse", "MECH", undefined]) {
      expect(firstError({ rollNo: "ABC123", branch })).toBe("Please choose your branch.");
    }
  });

  it("rejects extra fields such as role or onboarded", () => {
    expect(onboardingSchema.safeParse({ rollNo: "ABC123", branch: "CSE", role: "mentor" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ rollNo: "ABC123", branch: "CSE", onboarded: true }).success).toBe(false);
  });
});
