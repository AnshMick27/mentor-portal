import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "@/components/ProfileCard";
import type { UserProfile } from "@/lib/validation/user";

const profile: UserProfile = {
  uid: "u1",
  name: "Asha Verma",
  email: "asha@college.ac.in",
  role: "viewer",
  onboarded: true,
  showOnLeaderboard: false,
};

describe("ProfileCard (placeholder dashboards)", () => {
  it("shows the user's name and role", () => {
    const html = renderToStaticMarkup(<ProfileCard profile={profile} title="Mentor dashboard" />);
    expect(html).toContain("Mentor dashboard");
    expect(html).toContain("Asha Verma");
    expect(html).toContain("Viewer (read-only)");
  });

  it("escapes names instead of rendering HTML", () => {
    const html = renderToStaticMarkup(<ProfileCard profile={{ ...profile, name: "<script>x</script>" }} title="t" />);
    expect(html).not.toContain("<script>");
  });
});
