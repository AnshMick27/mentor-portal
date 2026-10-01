import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDataNote } from "@/components/PrivacyLink";
import { FeedbackSaved, SubmitFooter } from "@/components/student/FeedbackSubmitParts";
import { Note } from "@/components/ui/Note";
import { BackLink, TextLink, textLinkClasses } from "@/components/ui/TextLink";

describe("TextLink", () => {
  it("uses the theme link colour and underlines on hover when standalone", () => {
    const html = renderToStaticMarkup(<TextLink href="/student/tasks">All tasks</TextLink>);
    expect(html).toContain('href="/student/tasks"');
    expect(html).toContain("text-link");
    expect(html).toContain("hover:underline");
    expect(html).not.toContain("text-blue-700");
  });

  it("is always underlined inside a sentence and can be semibold", () => {
    expect(textLinkClasses({ inline: true })).toMatch(/(^| )underline( |$)/);
    expect(textLinkClasses({ strong: true })).toContain("font-semibold");
    expect(textLinkClasses({ className: "text-sm" }).endsWith("text-sm")).toBe(true);
  });
});

describe("BackLink", () => {
  it("names the destination, hides the arrow from screen readers and is 44 px tall", () => {
    const html = renderToStaticMarkup(<BackLink href="/mentor/students">Students</BackLink>);
    expect(html).toContain('href="/mentor/students"');
    expect(html).toContain('<span aria-hidden="true">←</span>Students');
    expect(html).toContain("min-h-11");
  });
});

describe("Note", () => {
  it("danger is an alert", () => {
    const html = renderToStaticMarkup(<Note tone="danger">Could not save.</Note>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("bg-red-50");
    expect(html).toContain("Could not save.");
  });

  it.each(["info", "success", "warning", "neutral"] as const)("%s has no role unless live", (tone) => {
    expect(renderToStaticMarkup(<Note tone={tone}>Text</Note>)).not.toContain("role=");
    expect(renderToStaticMarkup(<Note tone={tone} live>Text</Note>)).toContain('role="status"');
  });

  it("renders an optional title above the body", () => {
    const html = renderToStaticMarkup(
      <Note tone="success" title="Feedback ready: 7.0 / 10">
        Body
      </Note>,
    );
    expect(html).toMatch(/<p class="text-base font-semibold">Feedback ready: 7\.0 \/ 10<\/p>Body/);
  });
});

describe("feedback submit outcome (UX-09)", () => {
  it("a saved attempt whose reply could not be read is shown as success, not an error", () => {
    const html = renderToStaticMarkup(<FeedbackSaved />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Your feedback is ready.");
    expect(renderToStaticMarkup(<SubmitFooter state={{ status: "saved" }} disabled={false} />)).not.toContain('role="alert"');
  });
});

describe("links are never dimmed with opacity (UX-15)", () => {
  it("the AI data note uses the muted colour token instead of opacity", () => {
    const html = renderToStaticMarkup(<AiDataNote />);
    expect(html).toContain('class="text-sm text-muted"');
    expect(html).not.toMatch(/opacity-\d/);
    expect(html).toContain('href="/privacy"');
  });
});
