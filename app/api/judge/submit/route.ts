import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { dispatchJudge } from "@/lib/judge/dispatch";
import { draftElapsedMs } from "@/lib/submissions/integrity";
import { buildIntegrity } from "@/lib/submissions/integrityFlags";
import {
  DISPATCH_FAILED_MESSAGE,
  failJudgeDispatch,
  startJudgeSubmission,
} from "@/lib/submissions/judgeSubmission";
import { onFinished } from "@/lib/submissions/onFinished";
import { codeSubmitRequestSchema } from "@/lib/validation/submission";

/** Student only: submit code for a coding task; the judge reports back via /api/judge/callback (SPEC.md §9). */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student"]);
  if (!auth.ok) return auth.response;
  const uid = auth.value.uid;

  const body = await parseBody(request, codeSubmitRequestSchema);
  if (!body.ok) return body.response;

  const now = new Date();
  const elapsedMs = await draftElapsedMs(uid, body.data.taskId, now);
  const integrity = buildIntegrity(body.data.integrity, body.data.code.length, elapsedMs);

  let started;
  try {
    started = await startJudgeSubmission(uid, body.data, now, integrity);
  } catch (error) {
    console.error(`POST /api/judge/submit could not start a submission for uid ${uid}:`, error);
    return jsonError(500, "Could not save your submission. Please try again.");
  }
  if (!started.ok) return jsonError(started.status, started.message);
  const { submissionId, attempt, late, problemSlug } = started;

  try {
    await dispatchJudge({ submissionId, problemSlug, language: body.data.language, code: body.data.code });
  } catch (error) {
    console.error(`POST /api/judge/submit: dispatch failed for submissions/${submissionId}:`, error);
    try {
      await failJudgeDispatch(submissionId);
    } catch (updateError) {
      // The doc stays `queued`; after 10 minutes it shows as an error and is not counted (SPEC.md §9.5).
      console.error(`POST /api/judge/submit could not mark submissions/${submissionId} as error:`, updateError);
    }
    try {
      await onFinished({ submissionId, uid, taskId: body.data.taskId });
    } catch (hookError) {
      console.error(`POST /api/judge/submit: onFinished failed for submissions/${submissionId}:`, hookError);
    }
    return jsonError(502, DISPATCH_FAILED_MESSAGE);
  }

  return Response.json({ submission: { id: submissionId, attempt, late, status: "queued" } }, { status: 202 });
}
