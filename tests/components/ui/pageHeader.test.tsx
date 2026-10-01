import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryStatus } from "@/components/QueryStatus";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("renders the one h1 and a browser-tab title", () => {
    const html = renderToStaticMarkup(<PageHeader title="My tasks" />);
    expect(html).toContain("<title>My tasks · CDC Mentor Portal</title>");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>My tasks<\/h1>/);
    expect(html).not.toContain("href=");
  });

  it("can use a shorter tab title than the heading", () => {
    const html = renderToStaticMarkup(<PageHeader title="Hi, Asha" tabTitle="Home" />);
    expect(html).toContain("<title>Home · CDC Mentor Portal</title>");
    expect(html).toContain(">Hi, Asha</h1>");
  });

  it("puts the back link above the heading, then badge, actions and a muted subtitle", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Edit task"
        back={{ href: "/mentor/tasks", label: "Tasks" }}
        badge={<span>Draft</span>}
        actions={<button type="button">Save</button>}
        subtitle="Coding · Due 5 Oct"
      />,
    );
    expect(html.indexOf('href="/mentor/tasks"')).toBeLessThan(html.indexOf("<h1"));
    expect(html).toContain('<span aria-hidden="true">←</span>Tasks');
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<span>Draft</span>"));
    expect(html).toContain("Save</button>");
    expect(html).toContain('<div class="text-sm text-muted break-words">Coding · Due 5 Oct</div>');
  });
});

describe("QueryStatus loading label (UX-26)", () => {
  it("says what is loading, as a polite status", () => {
    const html = renderToStaticMarkup(
      <QueryStatus state={{ status: "loading" }} onRetry={() => undefined} loadingLabel="Loading your tasks…" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your tasks…");
  });

  it("falls back to Loading…", () => {
    expect(renderToStaticMarkup(<QueryStatus state={{ status: "loading" }} onRetry={() => undefined} />)).toContain("Loading…");
  });
});
