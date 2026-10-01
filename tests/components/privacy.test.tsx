import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { IntroSubmitForm } from "@/components/student/IntroSubmitForm";
import { ResumeSubmitForm } from "@/components/student/ResumeSubmitForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined, push: () => undefined }) }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ view: { status: "signedOut" }, message: null, signIn: async () => undefined }),
}));

const PRIVACY_LINK = 'href="/privacy"';
const idle = { status: "idle" } as const;

describe("privacy page", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);

  it("explains what is stored, who sees it and where work is sent, in plain words", () => {
    expect(html).toContain("How your data is used");
    for (const heading of ["What the portal stores", "Who can see it", "Where your work is sent", "The leaderboard", "Questions or changes"]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("The PDF file itself is never uploaded.");
    expect(html).toContain("outside AI service");
    expect(html).toContain("no internet");
    expect(html).toContain("Other students cannot see your work or your scores.");
    expect(html).toContain("only if you choose to");
  });

  it("names no email address or AI vendor, so it never goes out of date", () => {
    expect(html).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(html).not.toMatch(/groq|gemini|anthropic|claude|openai/i);
  });
});

describe("links to the privacy page", () => {
  it("footer: help line plus the link", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain("Need help? Message your mentor.");
    expect(html).toContain(PRIVACY_LINK);
  });

  it("login page", () => {
    expect(renderToStaticMarkup(<LoginPanel allowedDomain="college.ac.in" />)).toContain(PRIVACY_LINK);
  });

  it("next to the resume and intro forms, saying the text goes to an AI service", () => {
    for (const html of [
      renderToStaticMarkup(<ResumeSubmitForm state={idle} onSubmit={() => undefined} />),
      renderToStaticMarkup(<IntroSubmitForm state={idle} onSubmit={() => undefined} />),
    ]) {
      expect(html).toContain("Your text is sent to an outside AI service only to get feedback");
      expect(html).toContain(PRIVACY_LINK);
    }
  });
});
