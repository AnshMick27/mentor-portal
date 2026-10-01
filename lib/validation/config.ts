import { z } from "zod";
import { scoreSchema } from "@/lib/validation/submission";

/** `config/app` as stored (SPEC.md §6). A missing doc or field means the leaderboard is off. */
export const storedAppConfigSchema = z.object({ leaderboardEnabled: z.boolean().default(false) });
export type AppConfig = z.infer<typeof storedAppConfigSchema>;

/** `PATCH /api/config` body (mentor only). */
export const configPatchSchema = z.strictObject({ leaderboardEnabled: z.boolean("Choose on or off.") });

/** `POST /api/me/leaderboard` body (student: their own opt-in). */
export const leaderboardOptInSchema = z.strictObject({ showOnLeaderboard: z.boolean("Choose yes or no.") });

/** `GET/PATCH /api/config` reply. */
export const configResponseSchema = z.object({ config: z.object({ leaderboardEnabled: z.boolean() }) });

/** One leaderboard row: the ONLY fields that ever leave the server (SPEC.md §8.5). */
export const leaderboardEntrySchema = z.strictObject({
  rank: z.number().int().min(1),
  name: z.string(),
  overallAvg: scoreSchema,
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** `GET /api/leaderboard` reply. */
export const leaderboardResponseSchema = z.object({ entries: z.array(leaderboardEntrySchema) });

/** `POST /api/me/leaderboard` reply. */
export const optInResponseSchema = z.object({ showOnLeaderboard: z.boolean() });
