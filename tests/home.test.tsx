import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("home page", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("shows the portal name", () => {
    expect(html).toContain("CDC Mentor Portal");
  });

  it("links to /login", () => {
    expect(html).toContain('href="/login"');
  });
});
