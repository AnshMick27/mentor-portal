import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { getAppConfig, setLeaderboardEnabled } from "@/lib/leaderboard/store";
import { configPatchSchema } from "@/lib/validation/config";

/** Mentor/viewer: app settings (today only whether the leaderboard is on). Students use /api/leaderboard. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ config: await getAppConfig() });
  } catch (error) {
    console.error("GET /api/config failed:", error);
    return jsonError(500, "Could not load the settings. Please try again.");
  }
}

/** Mentor only: switch the leaderboard on or off. */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const body = await parseBody(request, configPatchSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ config: await setLeaderboardEnabled(body.data.leaderboardEnabled) });
  } catch (error) {
    console.error("PATCH /api/config failed:", error);
    return jsonError(500, "Could not save the settings. Please try again.");
  }
}
