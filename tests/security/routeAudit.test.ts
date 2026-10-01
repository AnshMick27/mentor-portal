import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as configSchemas from "@/lib/validation/config";
import * as onboardingSchemas from "@/lib/validation/onboarding";
import * as submissionSchemas from "@/lib/validation/submission";
import * as taskSchemas from "@/lib/validation/task";

// Every API route must say who may call it (SPEC.md §7.3). Users go through `requireUser` (or `verifyIdentity`
// for first login); the two machine routes have their own checks. Adding a route forces a decision here.
const ROOT = join(process.cwd(), "app", "api");
const MACHINE_ROUTES: Record<string, string> = {
  "judge/callback/route.ts": "verifyJudgeCallback(", // HMAC over the raw body (SPEC §7.7)
  "cron/recompute/route.ts": "checkCronAuth(", // CRON_SECRET bearer
};
const FIRST_LOGIN_ROUTES: Record<string, string> = { "me/route.ts": "verifyIdentity(" };

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

const routes = routeFiles(ROOT).map((path) => ({
  name: relative(ROOT, path).replaceAll("\\", "/"),
  source: readFileSync(path, "utf8"),
}));

/** Each exported HTTP handler's source, so a guard in one handler can't cover another. */
function handlers(source: string): { method: string; body: string }[] {
  const parts = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)\b/);
  const out: { method: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ method: parts[i] ?? "", body: parts[i + 1] ?? "" });
  return out;
}

const schemas: Record<string, unknown> = { ...configSchemas, ...onboardingSchemas, ...submissionSchemas, ...taskSchemas };

/** True for a zod object that rejects unknown keys (strictObject), looking through refinements and pipes. */
function isStrict(schema: z.ZodType): boolean {
  const def = schema.def as { type: string; catchall?: z.ZodType; in?: z.ZodType; innerType?: z.ZodType };
  if (def.type === "object") return def.catchall?.def.type === "never";
  if (def.type === "pipe" && def.in) return isStrict(def.in);
  if (def.innerType) return isStrict(def.innerType);
  return false;
}

describe("API route audit", () => {
  it("finds the routes (sanity check of the walker)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(12);
    expect(routes.map((r) => r.name)).toContain("tasks/[id]/route.ts");
  });

  it("every handler authorises its caller before doing anything else", () => {
    for (const route of routes) {
      const guard = MACHINE_ROUTES[route.name] ?? FIRST_LOGIN_ROUTES[route.name] ?? "requireUser(request, [";
      const list = handlers(route.source);
      expect(list.length, `${route.name} exports no handler`).toBeGreaterThan(0);
      for (const { method, body } of list) {
        expect(body, `${route.name} ${method} must call ${guard}`).toContain(guard);
      }
    }
  });

  it("only the allow-listed machine routes skip requireUser", () => {
    const withoutRequireUser = routes.filter((r) => !r.source.includes("requireUser(")).map((r) => r.name).sort();
    expect(withoutRequireUser).toEqual([...Object.keys(MACHINE_ROUTES), ...Object.keys(FIRST_LOGIN_ROUTES)].sort());
  });

  it("no route reads JSON without validation; every parsed body uses a strict zod schema", () => {
    for (const route of routes) {
      expect(route.source, `${route.name} must use parseBody`).not.toContain("request.json(");
      for (const match of route.source.matchAll(/parseBody\(request, (\w+)\)/g)) {
        const name = match[1] ?? "";
        const schema = schemas[name] as z.ZodType | undefined;
        expect(schema, `${route.name}: unknown schema ${name}`).toBeDefined();
        expect(isStrict(schema as z.ZodType), `${route.name}: ${name} must be a strictObject`).toBe(true);
      }
    }
  });

  it("the strictness check itself tells strict and loose objects apart", async () => {
    const { z: zod } = await import("zod");
    expect(isStrict(zod.strictObject({ a: zod.string() }))).toBe(true);
    expect(isStrict(zod.object({ a: zod.string() }))).toBe(false);
    expect(isStrict(zod.strictObject({ a: zod.string() }).superRefine(() => undefined))).toBe(true);
  });
});
