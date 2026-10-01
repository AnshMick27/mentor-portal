/** One way to write a score everywhere in text: "6.4 / 10", or "—" when there is none yet (UX-24). */
export function formatScore(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(1)} / 10`;
}

/** The big score at the top of a result: "6.4" large, "/ 10" muted. */
export function Score({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-3xl font-bold">—</span>;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-3xl font-bold">{value.toFixed(1)}</span>
      <span className="text-muted">/ 10</span>
    </span>
  );
}
