import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/recompute/route";
import { checkCronAuth } from "@/lib/cron/cronAuth";
import { recomputeAll } from "@/lib/stats/recompute";

const env = vi.hoisted(() => ({ CRON_SECRET: "cron-secret-123" as string | undefined }));
vi.mock("@/lib/config/env", () => ({ getServerEnv: () => env }));
vi.mock("@/lib/stats/recompute", () => ({ recomputeAll: vi.fn() }));

const recomputeMock = vi.mocked(recomputeAll);

async function call(authorization?: string) {
  const headers = authorization === undefined ? undefined : { authorization };
  const response = await GET(new Request("http://localhost/api/cron/recompute", { headers }));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  env.CRON_SECRET = "cron-secret-123";
  recomputeMock.mockReset();
  recomputeMock.mockResolvedValue({ students: 6, tasks: 3 });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("checkCronAuth", () => {
  it("accepts only the exact bearer token", () => {
    expect(checkCronAuth("Bearer s3cret", "s3cret")).toBe("ok");
    expect(checkCronAuth("Bearer s3cret ", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("bearer s3cret", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("s3cret", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("Bearer s3cre", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth(null, "s3cret")).toBe("unauthorized");
  });

  it("reports a missing or blank secret as a config problem, whatever the header", () => {
    expect(checkCronAuth("Bearer ", undefined)).toBe("config");
    expect(checkCronAuth("Bearer ", "")).toBe("config");
  });
});

describe("GET /api/cron/recompute", () => {
  it("401s a missing or wrong secret without recomputing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("500s when CRON_SECRET is unset, even for a request that sends an empty bearer", async () => {
    env.CRON_SECRET = undefined;
    const { status, body } = await call("Bearer ");
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Cron is not configured." });
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("recomputes everything and replies with counts only", async () => {
    const { status, body } = await call("Bearer cron-secret-123");
    expect(status).toBe(200);
    expect(body).toEqual({ students: 6, tasks: 3 });
    expect(recomputeMock).toHaveBeenCalledOnce();
  });

  it("500s without details when the recompute fails", async () => {
    recomputeMock.mockRejectedValue(new Error("Firestore quota exceeded for project x"));
    const { status, body } = await call("Bearer cron-secret-123");
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Recompute failed." });
  });
});

describe("vercel.json", () => {
  it("runs the recompute route once a day at 00:30 IST (19:00 UTC)", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([{ path: "/api/cron/recompute", schedule: "0 19 * * *" }]);
  });
});
