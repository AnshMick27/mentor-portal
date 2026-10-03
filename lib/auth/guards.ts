import type { UserProfile } from "@/lib/validation/user";

/** Page areas with access rules (SPEC.md §8.1). Guards are for navigation only; data is protected by rules and APIs. */
export type GuardArea = "student" | "mentor" | "onboarding" | "login" | "home";

export type AuthView = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; profile: UserProfile };

/** Where a signed-in user belongs by default. */
export function homeFor(profile: UserProfile): string {
  if (profile.role !== "student") return "/mentor";
  return profile.onboarded ? "/student" : "/onboarding";
}

/** Returns the path to redirect to, or null when the user may stay on this area (or auth is still loading). */
export function guardRedirect(area: GuardArea, auth: AuthView): string | null {
  if (auth.status === "loading") return null;
  // The landing page (`/`) is public: signed-out visitors stay on it (T41).
  if (auth.status === "signedOut") return area === "login" || area === "home" ? null : "/login";

  const { profile } = auth;
  const home = homeFor(profile);
  switch (area) {
    case "login":
    case "home":
      return home;
    case "student":
    case "onboarding":
      return home === `/${area}` ? null : home;
    case "mentor":
      return profile.role === "mentor" || profile.role === "viewer" ? null : home;
  }
}
