import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { LEADERBOARD_SIZE, rankEntries } from "@/lib/leaderboard/rank";
import { storedAppConfigSchema, type AppConfig, type LeaderboardEntry } from "@/lib/validation/config";
import { storedStudentStatsSchema } from "@/lib/validation/stats";

const configRef = () => getAdminDb().collection("config").doc("app");

/** `config/app`; a missing or malformed doc means "leaderboard off" (the default, SPEC.md §6). */
export async function getAppConfig(): Promise<AppConfig> {
  const snapshot = await configRef().get();
  const parsed = storedAppConfigSchema.safeParse(snapshot.exists ? snapshot.data() : {});
  if (!parsed.success) console.error("config/app does not match the config schema; treating the leaderboard as off");
  return parsed.success ? parsed.data : { leaderboardEnabled: false };
}

export async function setLeaderboardEnabled(leaderboardEnabled: boolean): Promise<AppConfig> {
  await configRef().set({ leaderboardEnabled });
  return { leaderboardEnabled };
}

/**
 * A student's own opt-in: `users/{uid}` and (if it exists yet) `studentStats/{uid}` change together, so the
 * leaderboard query on studentStats never disagrees with the profile.
 */
export async function setShowOnLeaderboard(uid: string, showOnLeaderboard: boolean): Promise<void> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const statsRef = db.collection("studentStats").doc(uid);
  await db.runTransaction(async (tx) => {
    const stats = await tx.get(statsRef);
    tx.update(userRef, { showOnLeaderboard });
    if (stats.exists) tx.update(statsRef, { showOnLeaderboard });
  });
}

/**
 * Top 10 opted-in students by overall average, ties by name: one indexed query, at most 10 reads
 * (firestore.indexes.json: studentStats showOnLeaderboard + overallAvg desc + name). Students without an
 * average are not ranked (Firestore leaves docs without the ordered field out).
 */
export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  const snapshot = await getAdminDb()
    .collection("studentStats")
    .where("showOnLeaderboard", "==", true)
    .orderBy("overallAvg", "desc")
    .orderBy("name", "asc")
    .limit(LEADERBOARD_SIZE)
    .get();
  const rows = snapshot.docs.flatMap((doc) => {
    const parsed = storedStudentStatsSchema.safeParse(doc.data());
    if (!parsed.success) console.error(`studentStats/${doc.id} does not match the stats schema; left off the leaderboard`);
    const stats = parsed.success ? parsed.data : undefined;
    return stats?.overallAvg === undefined ? [] : [{ name: stats.name, overallAvg: stats.overallAvg }];
  });
  return rankEntries(rows);
}
