import type { LeaderboardEntry } from "@/lib/validation/config";

export const LEADERBOARD_SIZE = 10;

/**
 * Competition ranking ("1, 2, 2, 4"): equal averages share a rank. Expects rows already sorted by
 * average (desc) then name, as the Firestore query returns them; returns only name and average.
 */
export function rankEntries(rows: readonly { name: string; overallAvg: number }[]): LeaderboardEntry[] {
  return rows.slice(0, LEADERBOARD_SIZE).map((row, index, list) => {
    const firstEqual = list.findIndex((other) => other.overallAvg === row.overallAvg);
    return { rank: firstEqual + 1, name: row.name, overallAvg: row.overallAvg };
  });
}
