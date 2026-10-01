import { jsonError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";
import { checkCronAuth } from "@/lib/cron/cronAuth";
import { recomputeAll } from "@/lib/stats/recompute";

// Reads every user, task and submission once; give it room on Vercel (same limit as /api/feedback).
export const maxDuration = 60;

/**
 * Daily Vercel Cron (vercel.json, 00:30 IST) so missed deadlines are counted (SPEC.md §8.7). Not a user
 * route: no `requireUser`; the CRON_SECRET bearer token is the only authorisation.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = checkCronAuth(request.headers.get("authorization"), getServerEnv().CRON_SECRET);
  if (auth === "config") {
    console.error("GET /api/cron/recompute refused: CRON_SECRET is not set");
    return jsonError(500, "Cron is not configured.");
  }
  if (auth === "unauthorized") return jsonError(401, "Unauthorized.");

  try {
    const counts = await recomputeAll();
    console.info(`Nightly stats recompute: ${counts.students} students, ${counts.tasks} tasks`);
    return Response.json(counts);
  } catch (error) {
    console.error("GET /api/cron/recompute failed:", error);
    return jsonError(500, "Recompute failed.");
  }
}
