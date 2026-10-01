import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedShell } from "@/components/auth/RouteGuard";
import type { UserProfile } from "@/lib/validation/user";

const nav = vi.hoisted(() => ({ pathname: "/student" }));
const auth = vi.hoisted(() => ({ profile: null as UserProfile | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ view: { status: "signedIn", profile: auth.profile }, signOut: async () => undefined }),
  useSignedInProfile: () => auth.profile,
}));

const base: UserProfile = {
  uid: "u1",
  name: "Asha Verma",
  email: "asha@college.ac.in",
  role: "student",
  rollNo: "0827CS1",
  branch: "CSE",
  onboarded: true,
  showOnLeaderboard: false,
};

const render = (profile: Partial<UserProfile>, pathname: string) => {
  nav.pathname = pathname;
  return renderToStaticMarkup(<AppHeader profile={{ ...base, ...profile }} />);
};
const navLinks = (html: string) => [...html.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]).slice(1);
const currentLink = (html: string) => /<a [^>]*aria-current="page"[^>]*>([^<]+)<\/a>/.exec(html)?.[1];
const brandHref = (html: string) => /<a [^>]*href="([^"]+)"[^>]*>CDC Mentor Portal<\/a>/.exec(html)?.[1];

describe("AppHeader navigation (T35b)", () => {
  it("students see Home and My tasks, and the brand goes to their home", () => {
    const html = render({}, "/student");
    expect(html).toContain('<nav aria-label="Main"');
    expect(navLinks(html)).toEqual(["Home", "My tasks"]);
    expect(brandHref(html)).toBe("/student");
    expect(currentLink(html)).toBe("Home");
  });

  it("marks My tasks as current on the task board and on a task page", () => {
    expect(currentLink(render({}, "/student/tasks"))).toBe("My tasks");
    expect(currentLink(render({}, "/student/tasks/abc123"))).toBe("My tasks");
  });

  it.each(["mentor", "viewer"] as const)("%s sees Dashboard, Tasks and Students", (role) => {
    const html = render({ role }, "/mentor");
    expect(navLinks(html)).toEqual(["Dashboard", "Tasks", "Students"]);
    expect(brandHref(html)).toBe("/mentor");
    expect(currentLink(html)).toBe("Dashboard");
  });

  it("marks the mentor section that contains the current page", () => {
    expect(currentLink(render({ role: "mentor" }, "/mentor/tasks/new"))).toBe("Tasks");
    expect(currentLink(render({ role: "mentor" }, "/mentor/students/u9"))).toBe("Students");
    expect(render({ role: "mentor" }, "/mentor/students").match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("shows no nav to a student who has not finished onboarding", () => {
    const html = render({ onboarded: false }, "/onboarding");
    expect(html).not.toContain("<nav");
    expect(brandHref(html)).toBe("/onboarding");
    expect(html).toContain("Sign out");
  });
});

describe("ProtectedShell skip link (T35b)", () => {
  beforeEach(() => {
    auth.profile = base;
    nav.pathname = "/student";
  });

  it("puts a Skip to content link first, pointing at the main landmark", () => {
    const html = renderToStaticMarkup(
      <ProtectedShell area="student">
        <p>Page body</p>
      </ProtectedShell>,
    );
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf("<header"));
    expect(html).toContain(">Skip to content</a>");
    expect(html).toMatch(/<main id="main"[^>]*><p>Page body<\/p><\/main>/);
  });
});
