import { jsonError } from "@/lib/api/errors";
import { MAX_CALLBACK_BYTES, SIGNATURE_HEADER, verifyJudgeCallback } from "@/lib/judge/verifyCallback";
import { applyJudgeCallback } from "@/lib/submissions/judgeSubmission";
import { onFinished } from "@/lib/submissions/onFinished";

const REFUSED: Record<"config" | "too_large" | "signature" | "payload", [number, string]> = {
  config: [500, "Judge callback is not configured."],
  too_large: [413, "Callback body is too large."],
  signature: [401, "Invalid signature."],
  payload: [400, "Invalid callback payload."],
};

/**
 * Called by the judge's `report` job, not by users: no `requireUser`, the HMAC signature over the raw body is
 * the only authorisation (SPEC.md §7.7, §9.4).
 */
export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CALLBACK_BYTES) return jsonError(...REFUSED.too_large);

  let raw: ArrayBuffer;
  try {
    raw = await request.arrayBuffer();
  } catch {
    return jsonError(400, "Could not read the callback body.");
  }

  const verified = verifyJudgeCallback(raw, request.headers.get(SIGNATURE_HEADER));
  if (!verified.ok) {
    if (verified.reason !== "signature") console.error(`POST /api/judge/callback refused: ${verified.reason}`);
    return jsonError(...REFUSED[verified.reason]);
  }
  const payload = verified.payload;
  if (payload.status === "error") {
    console.error(`Judge reported an internal error for submissions/${payload.submissionId}: ${payload.error}`);
  }

  let outcome;
  try {
    outcome = await applyJudgeCallback(payload, new Date());
  } catch (error) {
    console.error(`POST /api/judge/callback could not store the result of submissions/${payload.submissionId}:`, error);
    return jsonError(500, "Could not store the result.");
  }
  if (!outcome.ok) {
    console.warn(`POST /api/judge/callback ignored submissions/${payload.submissionId}: ${outcome.message}`);
    return jsonError(outcome.status, outcome.message);
  }

  try {
    await onFinished({ submissionId: payload.submissionId, uid: outcome.uid, taskId: outcome.taskId });
  } catch (error) {
    console.error(`POST /api/judge/callback: onFinished failed for submissions/${payload.submissionId}:`, error);
  }
  return Response.json({ ok: true, status: outcome.status });
}
