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
 * Decides what login does to `users/{uid}`: create it on first login, or switch to the staff role when the
 * email has since been added to MENTOR_EMAILS / VIEWER_EMAILS. Nobody is moved back to student here.
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
      },
    };
  }
  if (isStaffRole(listRole) && existing.role !== listRole) {
    const changes = { role: listRole, onboarded: true };
    return { action: "update", changes, user: { ...existing, ...changes } };
  }
  return { action: "none", user: existing };
}
