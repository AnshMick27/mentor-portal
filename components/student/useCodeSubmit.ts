"use client";

import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api/client";
import { codeSubmitRequestSchema } from "@/lib/validation/submission";
import type { Language } from "@/lib/validation/task";

export type CodeSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  /** `submissionId` lets the form show this attempt's live status; absent if the reply could not be read. */
  | { status: "sent"; submissionId?: string };

/** `POST /api/judge/submit` success reply (202). */
const sentReplySchema = z.object({ submission: z.object({ id: z.string() }) });

/**
 * Sends code to `POST /api/judge/submit`, validating locally first with the server's schema. The result
 * arrives later through the live attempt history, so success here only means "queued".
 */
export function useCodeSubmit(taskId: string) {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<CodeSubmitState>({ status: "idle" });

  async function submit(language: Language, code: string) {
    const parsed = codeSubmitRequestSchema.safeParse({ taskId, language, code });
    if (!parsed.success) {
      setState({ status: "error", message: parsed.error.issues[0]?.message ?? "Please check your code." });
      return;
    }
    setState({ status: "submitting" });
    const reply = await apiFetch(getIdToken, "/api/judge/submit", { method: "POST", body: parsed.data });
    if (!reply.ok) {
      setState({ status: "error", message: reply.message });
      return;
    }
    const sent = sentReplySchema.safeParse(reply.data);
    setState(sent.success ? { status: "sent", submissionId: sent.data.submission.id } : { status: "sent" });
  }

  return { state, submit };
}
