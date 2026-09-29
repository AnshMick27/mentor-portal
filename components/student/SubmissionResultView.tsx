import type { SubmissionResult } from "@/lib/validation/submission";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold">{title}</h4>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={index} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full feedback for one finished attempt (SPEC.md §8.4): score, criteria, strengths, improvements, next steps. */
export function SubmissionResultView({ result }: { result: SubmissionResult }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{result.score.toFixed(1)}</span>
        <span className="opacity-70">/ 10</span>
      </p>
      {result.judge && (
        <p>
          Passed {result.judge.passed} of {result.judge.total} tests · {result.judge.verdict}
        </p>
      )}
      {result.summary && <p className="break-words">{result.summary}</p>}

      {result.criteria && result.criteria.length > 0 && (
        <table className="w-full border-collapse text-left">
          <caption className="mb-1 text-left font-semibold">Criteria</caption>
          <thead>
            <tr className="border-b border-black/15 dark:border-white/20">
              <th scope="col" className="py-2 pr-2 font-medium">
                Criterion
              </th>
              <th scope="col" className="w-16 py-2 text-right font-medium">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {result.criteria.map((criterion) => (
              <tr key={criterion.name} className="border-b border-black/10 align-top dark:border-white/10">
                <td className="py-2 pr-2">
                  <span className="font-medium break-words">{criterion.name}</span>
                  {criterion.comment && <span className="mt-0.5 block break-words opacity-80">{criterion.comment}</span>}
                </td>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">{criterion.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <List title="What went well" items={result.strengths} />
      <List title="What to improve" items={result.improvements} />
      <List title="Next steps" items={result.nextSteps} />
    </div>
  );
}
