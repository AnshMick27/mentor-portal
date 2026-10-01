import { requireUser } from "@/lib/auth/requireUser";
import { handleRemoval } from "@/lib/students/removalRoute";

/** Mentor only: give a removed student their access back. */
export async function POST(request: Request, ctx: RouteContext<"/api/students/[uid]/restore">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { uid } = await ctx.params;
  return handleRemoval(uid, false, auth.value.uid);
}
