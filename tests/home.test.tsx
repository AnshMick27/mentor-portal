import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

// Signed out: the landing page stays (the redirect for signed-in users is tested in tests/auth/guards.test.ts).
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ view: { status: "signedOut" } }) }));

describe("home page", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("shows the portal name", () => {
    expect(html).toContain("CDC Mentor Portal");
  });

  it("links to /login", () => {
    expect(html).toContain('href="/login"');
  });
});
