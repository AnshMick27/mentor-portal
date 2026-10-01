import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unauthorized" | "config";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Vercel Cron calls the route with `Authorization: Bearer <CRON_SECRET>`. Comparing SHA-256 digests keeps
 * the compare constant-time even when the lengths differ (timingSafeEqual needs equal-length buffers).
 */
export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret) return "config";
  const expected = `Bearer ${secret}`;
  return timingSafeEqual(digest(authorization ?? ""), digest(expected)) ? "ok" : "unauthorized";
}
