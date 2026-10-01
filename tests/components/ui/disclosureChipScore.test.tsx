import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskList } from "@/components/tasks/TaskList";
import { Disclosure } from "@/components/ui/Disclosure";
import { formatScore, Score } from "@/components/ui/Score";
import { StatusChip } from "@/components/ui/StatusChip";

describe("Disclosure", () => {
  it("shows a chevron hidden from screen readers that turns only for its own details", () => {
    const html = renderToStaticMarkup(<Disclosure summary="Attempt 1">Body</Disclosure>);
    expect(html).toMatch(/^<details/);
    expect(html).not.toContain("open=");
    expect(html).toContain('<span aria-hidden="true"');
    expect(html).toContain("▾");
    expect(html).toContain("[details[open]&gt;summary&gt;&amp;]:rotate-180");
    expect(html).not.toContain("group-open");
  });

  it("has a 44 px summary with the browser marker hidden, and can start open", () => {
    const html = renderToStaticMarkup(
      <Disclosure summary="Latest" defaultOpen summaryClassName="px-4" className="rounded-lg">
        Body
      </Disclosure>,
    );
    expect(html).toContain('<details open="" class="rounded-lg">');
    expect(html).toMatch(/<summary class="[^"]*min-h-11[^"]*list-none[^"]*\[&amp;::-webkit-details-marker\]:hidden px-4"/);
    expect(html).toContain('<span class="min-w-0 flex-1">Latest</span>');
  });
});

describe("StatusChip", () => {
  it.each([
    ["success", "bg-green-100"],
    ["warning", "bg-amber-100"],
    ["danger", "bg-red-100"],
    ["info", "bg-blue-100"],
    ["neutral", "bg-surface"],
  ] as const)("%s tone keeps its text", (tone, colour) => {
    const html = renderToStaticMarkup(<StatusChip tone={tone}>Label</StatusChip>);
    expect(html).toContain(colour);
    expect(html).toContain(">Label</span>");
  });

  it("task badges say Published or Draft in words", () => {
    const task = { id: "t1", title: "Two sum", type: "coding", status: "draft", dueAt: "2026-10-05T18:29:00.000Z" };
    const html = renderToStaticMarkup(<TaskList tasks={[task as never]} canEdit={false} />);
    expect(html).toContain(">Draft</span>");
  });
});

describe("Score", () => {
  it("formats every score the same way", () => {
    expect(formatScore(6.44)).toBe("6.4 / 10");
    expect(formatScore(10)).toBe("10.0 / 10");
    expect(formatScore(undefined)).toBe("—");
  });

  it("shows the big score with a muted / 10, or a dash", () => {
    expect(renderToStaticMarkup(<Score value={7} />)).toContain('<span class="text-3xl font-bold">7.0</span><span class="text-muted">/ 10</span>');
    expect(renderToStaticMarkup(<Score value={undefined} />)).toBe('<span class="text-3xl font-bold">—</span>');
  });
});
