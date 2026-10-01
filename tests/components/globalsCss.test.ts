import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));

describe("app/globals.css theme (T35a)", () => {
  it("lets native controls follow the theme", () => {
    expect(css).toMatch(/:root\s*{[^}]*color-scheme:\s*light dark;/);
    expect(css).toMatch(/select option\s*{[^}]*background:\s*var\(--background\)/);
  });

  it("defines every design token in light and dark mode and exposes them to Tailwind", () => {
    for (const token of ["muted", "line", "line-strong", "surface", "link", "focus"]) {
      expect(css, `--${token} (light)`).toMatch(new RegExp(`--${token}:`));
      expect(darkBlock, `--${token} (dark)`).toMatch(new RegExp(`--${token}:`));
    }
    for (const token of ["muted", "line", "line-strong", "surface", "link"]) {
      expect(css).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it("has one global focus ring, using a light colour in dark mode", () => {
    expect(css).toMatch(/:focus-visible\s*{\s*outline:\s*2px solid var\(--focus\);\s*outline-offset:\s*2px;/);
    expect(darkBlock).toContain("--focus: #93c5fd;");
  });

  it("keeps mentor-written markdown readable at 360 px", () => {
    expect(css).toContain(".markdown img { max-width: 100%; height: auto; }");
    expect(css).toContain(".markdown a { color: var(--link);");
  });
});
