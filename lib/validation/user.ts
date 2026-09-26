import { z } from "zod";

export const ROLES = ["student", "mentor", "viewer"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** SPEC.md §6. */
export const BRANCHES = ["CSE", "IT", "CSIT", "CSE-AIML", "CY", "CSE-DS", "EC", "ME", "OTHER"] as const;
export const branchSchema = z.enum(BRANCHES);
export type Branch = z.infer<typeof branchSchema>;

/** The fields of `users/{uid}` the app relies on (`createdAt` is server-only bookkeeping). */
export const storedUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: roleSchema,
  rollNo: z.string().optional(),
  branch: branchSchema.optional(),
  onboarded: z.boolean(),
  showOnLeaderboard: z.boolean().default(false),
});
export type StoredUser = z.infer<typeof storedUserSchema>;

/** What the API returns about a user, and what `requireUser` hands to route handlers. */
export type UserProfile = StoredUser & { uid: string };
