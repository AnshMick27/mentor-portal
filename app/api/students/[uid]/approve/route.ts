import { jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/requireUser";
import { isValidUid } from "@/lib/dashboard/profile";
import { recomputeAllAfter } from "@/lib/stats/recompute";
import { approveStudent } from "@/lib/students/approval";

/** Mentor only: let a new student in (T48, SPEC.md §8.10). No body: the action is the URL. */
export async function POST(request: Request, ctx: RouteContext<"/api/students/[uid]/approve">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { uid } = await ctx.params;
  if (!isValidUid(uid)) return jsonError(404, "Student not found.");

  let result;
  try {
    result = await approveStudent(uid, auth.value.uid);
  } catch (error) {
    console.error(`POST /api/students/${uid}/approve failed:`, error);
    return jsonError(500, "Could not approve the student. Please try again.");
  }
  if (!result.ok) return jsonError(result.status, result.message);

  await recomputeAllAfter(`approve student ${uid}`);
  return Response.json({ student: { uid: result.uid, pendingApproval: false } });
}
