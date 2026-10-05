import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { openDraft } from "@/lib/submissions/integrity";
import { draftRequestSchema } from "@/lib/validation/submission";

/** Student only: the code or intro form was opened, so the server starts timing the answer (SPEC.md §8.9). */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student"]);
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, draftRequestSchema);
  if (!body.ok) return body.response;

  try {
    const result = await openDraft(auth.value.uid, body.data.taskId, new Date());
    if (!result.ok) return jsonError(result.status, result.message);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`POST /api/submissions/draft failed for uid ${auth.value.uid}:`, error);
    return jsonError(500, "Could not start timing this task.");
  }
}
