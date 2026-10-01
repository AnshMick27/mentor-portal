import type { ReactNode } from "react";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE: Record<ChipTone, string> = {
  neutral: "bg-surface text-foreground ring-1 ring-inset ring-line",
  info: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  success: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  danger: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

/** A short state label ("Published", "Missed", "Removed"). The words carry the meaning; colour only helps scanning. */
export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}
