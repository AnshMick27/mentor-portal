"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api/client";
import {
  feedbackRequestSchema,
  submissionResultSchema,
  isTypedAnswer,
  type AiTaskType,
  type IntegrityCounts,
  type SubmissionResult,
} from "@/lib/validation/submission";
import { openDraft } from "./useCodeSubmit";

/** `POST /api/feedback` success reply. */
const feedbackReplySchema = z.object({
  submission: z.object({ id: z.string(), attempt: z.number(), result: submissionResultSchema, late: z.boolean().default(false) }),
});

export type FeedbackSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  /** Saved, but the reply could not be read here: the feedback is in the attempt history. */
  | { status: "saved" }
  | { status: "done"; result: SubmissionResult; late: boolean };

/** Sends resume/intro/scenario text to `POST /api/feedback`; validates locally first with the same schema as the server. */
export function useFeedbackSubmit(taskId: string, type: AiTaskType) {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<FeedbackSubmitState>({ status: "idle" });
  useEffect(() => {
    if (isTypedAnswer(type)) openDraft(getIdToken, taskId);
  }, [getIdToken, taskId, type]);

  async function submit(content: string, integrity?: IntegrityCounts) {
    const parsed = feedbackRequestSchema.safeParse({ taskId, type, content, ...(isTypedAnswer(type) ? { integrity } : {}) });
    if (!parsed.success) {
      setState({ status: "error", message: parsed.error.issues[0]?.message ?? "Please check your text." });
      return;
    }
    setState({ status: "submitting" });
    const reply = await apiFetch(getIdToken, "/api/feedback", { method: "POST", body: parsed.data });
    if (!reply.ok) {
      setState({ status: "error", message: reply.message });
      return;
    }
    const data = feedbackReplySchema.safeParse(reply.data);
    if (!data.success) {
      setState({ status: "saved" });
    } else {
      setState({ status: "done", result: data.data.submission.result, late: data.data.submission.late });
    }
  }

  return { state, submit };
}
