import type { ReactNode } from "react";

/** One number in a stats grid (Stitch design, T40b): small uppercase label, big value, optional muted line. Use inside a `<dl>`. */
export function Stat({ label, value, hint, children }: { label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
      {hint !== undefined && <dd className="text-xs text-muted">{hint}</dd>}
      {children}
    </div>
  );
}
