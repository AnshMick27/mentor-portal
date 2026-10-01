import type { ReactNode } from "react";

export type NoteTone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<NoteTone, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
  success: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  danger: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  neutral: "border-line bg-surface",
};

/**
 * A boxed message (docs/UX_REVIEW.md §3.2). `danger` is announced at once (`role="alert"`); `live` makes any other
 * tone a polite status that screen readers read when it appears. Wording carries the meaning, never colour alone.
 */
export function Note({
  tone,
  title,
  live = false,
  className,
  children,
}: {
  tone: NoteTone;
  title?: ReactNode;
  live?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const role = tone === "danger" ? "alert" : live ? "status" : undefined;
  return (
    <div role={role} className={["flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm", TONE[tone], className].filter(Boolean).join(" ")}>
      {title && <p className="text-base font-semibold">{title}</p>}
      {children}
    </div>
  );
}
