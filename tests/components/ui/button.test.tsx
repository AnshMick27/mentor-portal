import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/Button";

const classOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("buttonClasses", () => {
  it("defaults to a 44 px primary button", () => {
    const classes = buttonClasses();
    expect(classes).toContain("min-h-11");
    expect(classes).toContain("bg-primary text-white");
    expect(classes).toContain("px-5 text-base");
    expect(classes).toContain("disabled:opacity-60");
  });

  it.each([
    ["secondary", "border border-line-strong"],
    ["danger", "bg-red-700 text-white"],
    ["ghost", "hover:bg-surface"],
  ] as const)("%s variant", (variant, expected) => {
    const classes = buttonClasses({ variant });
    expect(classes).toContain(expected);
    expect(classes).not.toContain("bg-primary");
  });

  it("small size keeps the 44 px height and appends extra classes", () => {
    const classes = buttonClasses({ size: "sm", className: "self-start" });
    expect(classes).toContain("min-h-11");
    expect(classes).toContain("px-4 text-sm");
    expect(classes.endsWith("self-start")).toBe(true);
  });
});

describe("Button", () => {
  it("is type=button by default and passes native props through", () => {
    const html = renderToStaticMarkup(<Button aria-describedby="hint">Save</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-describedby="hint"');
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain('disabled=""');
  });

  it("keeps type=submit and the variant classes", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" variant="danger">
        Yes, remove
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(classOf(html)).toContain("bg-red-700");
  });

  it("while busy: disabled and shows the busy label", () => {
    const html = renderToStaticMarkup(
      <Button busy busyLabel="Saving…">
        Continue
      </Button>,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain(">Saving…</button>");
    expect(html).not.toContain("Continue");
  });

  it("busy without a label keeps the children; disabled works on its own", () => {
    expect(renderToStaticMarkup(<Button busy>Go</Button>)).toContain('disabled=""');
    expect(renderToStaticMarkup(<Button disabled>Go</Button>)).toContain('disabled=""');
  });
});

describe("ButtonLink", () => {
  it("renders a link styled as a button", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/mentor/students" variant="secondary">
        Students
      </ButtonLink>,
    );
    expect(html).toContain('href="/mentor/students"');
    expect(html).toMatch(/^<a /);
    expect(classOf(html)).toContain("border-line-strong");
    expect(classOf(html)).toContain("min-h-11");
  });
});
