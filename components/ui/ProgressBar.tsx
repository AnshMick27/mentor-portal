/**
 * A thin bar for "x of y" (Stitch design, T40b). Decorative: the same numbers are always written next to it, so it is
 * hidden from screen readers instead of announcing a second, wordless progressbar.
 */
export function ProgressBar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "success" | "warning" }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { primary: "bg-primary dark:bg-link", success: "bg-emerald-700 dark:bg-emerald-400", warning: "bg-amber-700 dark:bg-amber-400" }[tone];
  return (
    <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
