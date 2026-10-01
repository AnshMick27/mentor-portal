import { requireUser } from "@/lib/auth/requireUser";
import { handleRemoval } from "@/lib/students/removalRoute";

/** Mentor only: block a student's access to the portal (data kept, reversible). */
export async function POST(request: Request, ctx: RouteContext<"/api/students/[uid]/remove">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { uid } = await ctx.params;
  return handleRemoval(uid, true, auth.value.uid);
}
