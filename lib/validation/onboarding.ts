import { z } from "zod";
import { BRANCHES } from "./user";

export const ROLL_NO_MESSAGE = "Roll number must be 6–15 letters or digits (no spaces or symbols).";

/** Shared by the /onboarding form and POST /api/onboarding. Strict: unknown fields (e.g. `role`) are rejected. */
export const onboardingSchema = z.strictObject({
  rollNo: z
    .string(ROLL_NO_MESSAGE)
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,15}$/, ROLL_NO_MESSAGE),
  branch: z.enum(BRANCHES, "Please choose your branch."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
