import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { generateFeedback } from "@/lib/ai/provider";
import { getRubric } from "@/lib/ai/rubrics";
import {
  AI_FAILED_MESSAGE,
  feedbackToResult,
  finishFeedbackSubmission,
  startFeedbackSubmission,
} from "@/lib/submissions/feedbackSubmission";
import { draftElapsedMs } from "@/lib/submissions/integrity";
import { buildIntegrity } from "@/lib/submissions/integrityFlags";
import { onFinished } from "@/lib/submissions/onFinished";
import { feedbackRequestSchema, type SubmissionResult } from "@/lib/validation/submission";

/** A slow AI reply (plus one retry) must not be cut off by the platform's default function timeout. */
export const maxDuration = 60;

/** Student only: submit a resume or written intro and get AI feedback (SPEC.md §8.4, §10). */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["student"]);
  if (!auth.ok) return auth.response;
  const uid = auth.value.uid;

  const body = await parseBody(request, feedbackRequestSchema);
  if (!body.ok) return body.response;

  const now = new Date();
  // Only the intro is typed in a paste-blocked box; a resume is meant to be pasted (SPEC.md §8.9).
  const integrity =
    body.data.type === "intro_written"
      ? buildIntegrity(body.data.integrity, body.data.content.length, await draftElapsedMs(uid, body.data.taskId, now))
      : undefined;

  let started;
  try {
    started = await startFeedbackSubmission(uid, body.data, now, integrity);
  } catch (error) {
    console.error(`POST /api/feedback could not start a submission for uid ${uid}:`, error);
    return jsonError(500, "Could not save your submission. Please try again.");
  }
  if (!started.ok) return jsonError(started.status, started.message);
  const { submissionId, attempt, late } = started;

  let result: SubmissionResult | undefined;
  try {
    const feedback = await generateFeedback({
      type: body.data.type,
      rubric: getRubric(body.data.type),
      content: body.data.content,
    });
    result = feedbackToResult(feedback);
  } catch (error) {
    console.error(`POST /api/feedback: AI feedback failed for submissions/${submissionId}:`, error);
  }

  try {
    await finishFeedbackSubmission(submissionId, result ? { result } : { error: AI_FAILED_MESSAGE });
  } catch (error) {
    // The doc stays `running`; after 10 minutes it shows as an error and is not counted (SPEC.md §9.5).
    console.error(`POST /api/feedback could not store the outcome of submissions/${submissionId}:`, error);
    return jsonError(500, "Could not save your feedback. Please try again in a few minutes.");
  }

  try {
    await onFinished({ submissionId, uid, taskId: body.data.taskId });
  } catch (error) {
    console.error(`POST /api/feedback: onFinished failed for submissions/${submissionId}:`, error);
  }

  if (!result) return jsonError(502, AI_FAILED_MESSAGE);
  return Response.json({ submission: { id: submissionId, attempt, late, status: "done", result } });
}
