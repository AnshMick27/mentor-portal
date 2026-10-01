import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import type { LeaderboardEntry } from "@/lib/validation/config";

/** Top 10: rank, name and average only (SPEC.md §8.5). */
export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState>Nobody is on the leaderboard yet.</EmptyState>;
  }
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">Leaderboard: top {entries.length} by average score</caption>
      <thead>
        <tr className="border-b border-black/15 dark:border-white/20">
          <th scope="col" className="w-12 py-2 font-medium">
            #
          </th>
          <th scope="col" className="py-2 font-medium">
            Name
          </th>
          <th scope="col" className="w-20 py-2 text-right font-medium">
            Average
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={`${entry.rank}-${entry.name}-${index}`} className="border-b border-black/10 dark:border-white/10">
            <td className="py-2 font-semibold">{entry.rank}</td>
            <td className="py-2 pr-2 break-words">{entry.name}</td>
            <td className="py-2 text-right tabular-nums">{entry.overallAvg.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type SwitchProps = {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
};

/** A labelled on/off switch (a checkbox with role="switch"), with a one-line hint and an error line. */
export function Switch({ id, label, hint, checked, disabled = false, error, onChange }: SwitchProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${id}-hint`}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-7 w-12 shrink-0 rounded-full bg-black/50 transition-colors peer-checked:bg-blue-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-700 peer-disabled:opacity-50 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 dark:bg-white/45"
        />
        <span className="font-medium">{label}</span>
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
      {error && (
        <Note tone="danger">{error}</Note>
      )}
    </div>
  );
}
