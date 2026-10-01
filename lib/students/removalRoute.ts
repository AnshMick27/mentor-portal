import "server-only";
import { jsonError } from "@/lib/api/errors";
import { isValidUid } from "@/lib/dashboard/profile";
import { recomputeAllAfter } from "@/lib/stats/recompute";
import { setStudentRemoved } from "@/lib/students/removal";

/**
 * Shared body of `POST /api/students/[uid]/remove` and `/restore`, called AFTER the route's own
 * `requireUser(request, ["mentor"])` (viewers are read-only). No request body: the action is the URL.
 * Stats are recomputed afterwards; a recompute failure is logged and fixed by the nightly cron.
 */
export async function handleRemoval(uid: string, removed: boolean, mentorUid: string): Promise<Response> {
  if (!isValidUid(uid)) return jsonError(404, "Student not found.");

  const action = removed ? "remove" : "restore";
  let result;
  try {
    result = await setStudentRemoved(uid, removed, mentorUid);
  } catch (error) {
    console.error(`POST /api/students/${uid}/${action} failed:`, error);
    return jsonError(500, `Could not ${action} the student. Please try again.`);
  }
  if (!result.ok) return jsonError(result.status, result.message);

  await recomputeAllAfter(`${action} student ${uid}`);
  return Response.json({ student: { uid: result.uid, removed: result.removed } });
}
