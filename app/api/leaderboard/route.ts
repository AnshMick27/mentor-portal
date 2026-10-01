import { jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/requireUser";
import { getAppConfig, loadLeaderboard } from "@/lib/leaderboard/store";

/**
 * Top 10 opted-in students by average (SPEC.md §8.5). 404 while the mentor has it switched off. Replies
 * carry only rank, name and average: never uid, email or roll number.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student", "mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  try {
    if (!(await getAppConfig()).leaderboardEnabled) return jsonError(404, "Leaderboard is off.");
    return Response.json({ entries: await loadLeaderboard() });
  } catch (error) {
    console.error("GET /api/leaderboard failed:", error);
    return jsonError(500, "Could not load the leaderboard. Please try again.");
  }
}
