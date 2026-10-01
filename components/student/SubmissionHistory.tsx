import { cardClasses } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { formatScore } from "@/components/ui/Score";
import { formatIst } from "@/lib/dates/ist";
import { judgeStatusView } from "@/lib/submissions/judgeDisplay";
import { effectiveStatus } from "@/lib/submissions/scoring";
import { newestFirst, type SubmissionView } from "@/lib/submissions/submissionDoc";
import { SubmissionResultView } from "./SubmissionResultView";

/** One-line status for the collapsed row. */
export function statusLabel(submission: SubmissionView, now: Date): string {
  const { status } = effectiveStatus(submission, now);
  if (submission.type === "coding" && status !== "done") return judgeStatusView(submission, now).headline;
  if (status === "done") return submission.result ? formatScore(submission.result.score) : "Done";
  if (status === "error") return "Not counted";
  return status === "queued" ? "Waiting…" : "Checking…";
}

const TONE_CLASS = {
  waiting: "border-black/10 dark:border-white/15",
  passed: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
  failed: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  error: "border-black/10 dark:border-white/15",
} as const;

/** Live judge status for a coding attempt; the full result (score, compile output) follows when done. */
export function JudgeStatus({ submission, now }: { submission: SubmissionView; now: Date }) {
  const view = judgeStatusView(submission, now);
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm ${TONE_CLASS[view.tone]}`}>
      <span className="text-base font-semibold">{view.headline}</span>
      {view.detail && <span>{view.detail}</span>}
    </div>
  );
}

/** Who is reading: the student on their task page, or a mentor/viewer on the student's profile. */
export type AttemptAudience = "student" | "mentor";

const WORDING: Record<AttemptAudience, { notCounted: string; pending: string; sent: string }> = {
  student: {
    notCounted: "This attempt was not counted, so you can try again.",
    pending: "Your feedback is being prepared. This page updates by itself.",
    sent: "What you sent",
  },
  mentor: {
    notCounted: "Not counted (the student can try again).",
    pending: "Still being checked.",
    sent: "What they sent",
  },
};

function AttemptBody({ submission, now, audience }: { submission: SubmissionView; now: Date; audience: AttemptAudience }) {
  const effective = effectiveStatus(submission, now);
  if (submission.type === "coding" && !(effective.status === "done" && submission.result)) {
    return <JudgeStatus submission={submission} now={now} />;
  }
  if (effective.status === "done" && submission.result) return <SubmissionResultView result={submission.result} />;
  if (effective.status === "error") {
    return (
      <p className="text-sm">
        {effective.error ?? "Something went wrong."} {WORDING[audience].notCounted}
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-muted">
      {WORDING[audience].pending}
    </p>
  );
}

/**
 * Attempts on one task, newest first; the newest is expanded. Shared by the student's task page and the
 * mentor's student profile (`audience` picks the wording).
 */
export function AttemptList({
  submissions,
  now,
  audience = "student",
}: {
  submissions: readonly SubmissionView[];
  now: Date;
  audience?: AttemptAudience;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {newestFirst(submissions).map((submission, index) => (
        <li key={submission.id}>
          <Disclosure
            defaultOpen={index === 0}
            className={cardClasses({ padding: "none" })}
            summaryClassName="px-4 py-2"
            summary={
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium">
                  Attempt {submission.attempt}
                  <span className="ml-2 text-sm font-normal text-muted">{formatIst(submission.createdAt.toISOString())}</span>
                </span>
                <span className="text-sm font-semibold">{statusLabel(submission, now)}</span>
              </span>
            }
          >
            <div className="flex flex-col gap-4 border-t border-line px-4 py-3">
              <AttemptBody submission={submission} now={now} audience={audience} />
              <Disclosure summary={WORDING[audience].sent} summaryClassName="text-sm font-medium">
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-black/[0.05] p-3 font-mono text-xs whitespace-pre-wrap break-words dark:bg-white/[0.08]">
                  {submission.content}
                </pre>
              </Disclosure>
            </div>
          </Disclosure>
        </li>
      ))}
    </ul>
  );
}

/** The student's attempts on one task, newest first; the newest is expanded. */
export function SubmissionHistory({ submissions, now }: { submissions: readonly SubmissionView[]; now: Date }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-lg font-semibold">
        Your attempts
      </h2>
      {submissions.length === 0 ? (
        <p className="text-sm text-muted">No attempts yet. Your feedback will appear here.</p>
      ) : (
        <AttemptList submissions={submissions} now={now} />
      )}
    </section>
  );
}
