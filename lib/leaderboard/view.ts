import type { ApiResult } from "@/lib/api/client";
import { configResponseSchema, leaderboardResponseSchema, type LeaderboardEntry } from "@/lib/validation/config";

const UNEXPECTED = "The server sent an unexpected reply. Please reload the page.";

export type LeaderboardView =
  | { status: "loading" }
  | { status: "off" }
  | { status: "ready"; entries: LeaderboardEntry[] }
  | { status: "error"; message: string };

/** `GET /api/leaderboard` → what the card shows. A 404 is not an error: the mentor has it switched off. */
export function leaderboardView(result: ApiResult): LeaderboardView {
  if (!result.ok) return result.status === 404 ? { status: "off" } : { status: "error", message: result.message };
  const parsed = leaderboardResponseSchema.safeParse(result.data);
  return parsed.success ? { status: "ready", entries: parsed.data.entries } : { status: "error", message: UNEXPECTED };
}

export type ConfigView =
  | { status: "loading" }
  | { status: "ready"; leaderboardEnabled: boolean }
  | { status: "error"; message: string };

/** `GET/PATCH /api/config` → the mentor's on/off switch. */
export function configView(result: ApiResult): ConfigView {
  if (!result.ok) return { status: "error", message: result.message };
  const parsed = configResponseSchema.safeParse(result.data);
  return parsed.success
    ? { status: "ready", leaderboardEnabled: parsed.data.config.leaderboardEnabled }
    : { status: "error", message: UNEXPECTED };
}
