import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskList } from "@/components/tasks/TaskList";
import { Card, CardLink, cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";

describe("Card", () => {
  it("uses the theme card tokens, with md padding by default", () => {
    expect(cardClasses()).toBe("rounded-lg shadow-card ring-1 bg-card ring-line p-4");
    expect(cardClasses({ padding: "sm", className: "grid" })).toBe("rounded-lg shadow-card ring-1 bg-card ring-line p-3 grid");
  });

  it("renders as the requested element", () => {
    expect(renderToStaticMarkup(<Card as="li">x</Card>)).toBe('<li class="rounded-lg shadow-card ring-1 bg-card ring-line p-4">x</li>');
  });

  it("CardLink makes the whole card one link with a hover tint", () => {
    const html = renderToStaticMarkup(<CardLink href="/student/tasks/t1">Task</CardLink>);
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/student/tasks/t1"');
    expect(html).toContain("hover:bg-surface");
  });
});

describe("Section", () => {
  it("is named by its visible heading, not by a second aria-label", () => {
    const html = renderToStaticMarkup(<Section title="This week">body</Section>);
    const labelledBy = /<section aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`<h2 id="${labelledBy}" class="text-lg font-semibold">This week</h2>`);
    expect(html).not.toContain("aria-label=");
  });

  it("shows a muted count, an action and can be an h3", () => {
    const html = renderToStaticMarkup(
      <Section title="Due soon" count={2} action={<a href="/x">All</a>} level={3}>
        body
      </Section>,
    );
    expect(html).toContain('Due soon <span class="text-sm font-normal text-muted">(2)</span></h3>');
    expect(html).toContain('<a href="/x">All</a>');
  });

  it("gives two sections on one page different ids", () => {
    const html = renderToStaticMarkup(
      <>
        <Section title="A">a</Section>
        <Section title="B">b</Section>
      </>,
    );
    const ids = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("EmptyState", () => {
  it("is a muted line on its own", () => {
    expect(renderToStaticMarkup(<EmptyState>No tasks yet.</EmptyState>)).toBe('<p class="text-sm text-muted">No tasks yet.</p>');
  });

  it("can offer the one action that fixes it", () => {
    const mentor = renderToStaticMarkup(<TaskList tasks={[]} canEdit />);
    expect(mentor).toContain("No tasks yet.");
    expect(mentor).toContain('href="/mentor/tasks/new"');
    expect(mentor).toContain("Create your first task");
    expect(renderToStaticMarkup(<TaskList tasks={[]} canEdit={false} />)).not.toContain("/mentor/tasks/new");
  });
});

describe("no hand-written card styles left (T35d2)", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
    });

  it("components use cardClasses instead of local CARD constants", () => {
    for (const file of files(join(process.cwd(), "components"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/const CARD\b/);
    }
  });
});
