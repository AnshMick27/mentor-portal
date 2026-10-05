import type { Role, StoredUser } from "@/lib/validation/user";

export const STAFF_ROLES: readonly Role[] = ["mentor", "viewer"];

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** Role from the server lists (SPEC.md §2). Mentor wins if an email is in both lists. */
export function decideRole(
  email: string,
  mentorEmails: ReadonlySet<string>,
  viewerEmails: ReadonlySet<string>,
): Role {
  const normalized = email.trim().toLowerCase();
  if (mentorEmails.has(normalized)) return "mentor";
  if (viewerEmails.has(normalized)) return "viewer";
  return "student";
}

/** True only for `local@<domain>` exactly: no subdomains, no look-alike suffixes. */
export function isAllowedEmail(email: string, allowedDomain: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return false;
  return normalized.slice(at + 1) === allowedDomain.trim().toLowerCase();
}

export type Identity = { uid: string; email: string; name: string };

/** `user` is the doc as it will be after the plan is applied. */
export type ProvisionPlan =
  | { action: "create"; user: StoredUser }
  | { action: "update"; changes: Pick<StoredUser, "role" | "onboarded">; user: StoredUser }
  | { action: "none"; user: StoredUser };

/**
 * Decides what login does to `users/{uid}`: create it on first login, or make the stored role follow the env
 * lists (SPEC.md §8.1, T43): added to MENTOR_EMAILS / VIEWER_EMAILS → that staff role; a mentor/viewer on neither
 * list any more → student. A demoted account counts as onboarded only if it already has a roll number and branch
 * (it was a student before); otherwise it goes through onboarding like any new student. Name and email never change.
 * A NEW student waits for a mentor's approval (`pendingApproval`, T48); staff and demoted staff never do.
 */
export function planProvision(existing: StoredUser | undefined, identity: Identity, listRole: Role): ProvisionPlan {
  if (!existing) {
    return {
      action: "create",
      user: {
        name: identity.name,
        email: identity.email.toLowerCase(),
        role: listRole,
        onboarded: isStaffRole(listRole),
        showOnLeaderboard: false,
        ...(isStaffRole(listRole) ? {} : { pendingApproval: true }),
      },
    };
  }
  if (existing.role === listRole) return { action: "none", user: existing };
  const onboarded = isStaffRole(listRole) || Boolean(existing.rollNo && existing.branch);
  const changes = { role: listRole, onboarded };
  return { action: "update", changes, user: { ...existing, ...changes } };
}
