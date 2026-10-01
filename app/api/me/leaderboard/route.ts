import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { setShowOnLeaderboard } from "@/lib/leaderboard/store";
import { leaderboardOptInSchema } from "@/lib/validation/config";

/** Student only: opt in to (or out of) the leaderboard. Only ever changes the caller's own docs. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student"]);
  if (!auth.ok) return auth.response;
  const body = await parseBody(request, leaderboardOptInSchema);
  if (!body.ok) return body.response;
  const { uid } = auth.value;
  try {
    await setShowOnLeaderboard(uid, body.data.showOnLeaderboard);
    return Response.json({ showOnLeaderboard: body.data.showOnLeaderboard });
  } catch (error) {
    console.error(`POST /api/me/leaderboard failed for uid ${uid}:`, error);
    return jsonError(500, "Could not save your choice. Please try again.");
  }
}
