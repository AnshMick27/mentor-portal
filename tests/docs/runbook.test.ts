import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const runbook = read("docs/RUNBOOK.md");

describe("docs/RUNBOOK.md stays in step with the project", () => {
  it("documents every variable in .env.example", () => {
    const vars = [...read(".env.example").matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] ?? "");
    expect(vars.length).toBeGreaterThanOrEqual(20);
    for (const name of vars) expect(runbook, `${name} missing from the runbook`).toContain(`\`${name}\``);
  });

  it("only mentions npm scripts that exist in package.json", () => {
    const scripts = Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts);
    const used = [...runbook.matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1] ?? "");
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(scripts, `npm run ${name}`).toContain(name);
  });

  it("is linked from the README", () => {
    expect(read("README.md")).toContain("docs/RUNBOOK.md");
  });

  it("contains no secret-looking values", () => {
    expect(runbook).not.toMatch(/github_pat_|gsk_|sk-ant-|AIza[0-9A-Za-z_-]{20}|-----BEGIN/);
  });
});
