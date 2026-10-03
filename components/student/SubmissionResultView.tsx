import { Score } from "@/components/ui/Score";
import { verdictLabel } from "@/lib/submissions/judgeDisplay";
import type { SubmissionResult } from "@/lib/validation/submission";

type ListTone = "success" | "warning" | "neutral";

const LIST_TITLE: Record<ListTone, string> = {
  success: "text-emerald-800 dark:text-emerald-300",
  warning: "text-orange-800 dark:text-orange-300",
  neutral: "",
};

function List({ title, items, tone }: { title: string; items: string[]; tone: ListTone }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-card p-4 ring-1 ring-line">
      <h3 className={`font-semibold ${LIST_TITLE[tone]}`}>{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5">
        {items.map((item, index) => (
          <li key={index} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Score pill colour by band; the number itself is always written, so colour only helps scanning. */
function scoreTone(score: number): string {
  if (score >= 8.5) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100";
  if (score >= 7.5) return "bg-surface-strong text-foreground";
  return "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100";
}

/**
 * Full feedback for one finished attempt (SPEC.md §8.4): score, criteria, strengths, improvements, next steps.
 * Laid out like the Stitch "Submission Evaluation" screen (T40c); shared by the student task page and the mentor profile.
 */
export function SubmissionResultView({ result }: { result: SubmissionResult }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        <Score value={result.score} />
      </p>
      {result.judge && (
        <p className="rounded-lg bg-surface px-4 py-3 font-medium">
          Passed {result.judge.passed} of {result.judge.total} tests · {verdictLabel(result.judge)}
        </p>
      )}
      {result.judge?.compileOutput && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">Compiler output</h3>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs whitespace-pre text-slate-100">
            {result.judge.compileOutput}
          </pre>
        </div>
      )}
      {/* A judge summary only repeats the verdict line above. */}
      {result.summary && !result.judge && (
        <p className="rounded-lg bg-surface px-4 py-3 leading-relaxed break-words">{result.summary}</p>
      )}

      {result.criteria && result.criteria.length > 0 && (
        <table className="w-full border-collapse text-left">
          <caption className="mb-2 text-left font-semibold">Criteria</caption>
          <thead>
            <tr className="text-[11px] tracking-wider text-muted uppercase">
              <th scope="col" className="px-1 py-2 font-semibold">
                Criterion
              </th>
              <th scope="col" className="w-16 px-1 py-2 text-right font-semibold">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {result.criteria.map((criterion) => (
              <tr key={criterion.name} className="border-t border-line align-top">
                <td className="px-1 py-3">
                  <span className="font-medium break-words">{criterion.name}</span>
                  {criterion.comment && <span className="mt-0.5 block break-words text-muted">{criterion.comment}</span>}
                </td>
                <td className="px-1 py-3 text-right whitespace-nowrap">
                  <span className={`inline-block rounded px-2 py-0.5 font-semibold tabular-nums ${scoreTone(criterion.score)}`}>
                    {criterion.score.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(result.strengths.length > 0 || result.improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <List title="What went well" items={result.strengths} tone="success" />
          <List title="What to improve" items={result.improvements} tone="warning" />
        </div>
      )}
      <List title="Next steps" items={result.nextSteps} tone="neutral" />
    </div>
  );
}
