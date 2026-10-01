import type { ReactNode } from "react";

/**
 * A row that opens to show more (docs/UX_REVIEW.md UX-05). A flex `<summary>` loses the browser's arrow, so this one
 * ends with its own ▾ that turns when open. The chevron only follows its own `<details>` (`details[open] > summary`),
 * so it stays right when disclosures are nested (profile → task → attempt → "What they sent").
 */
export function Disclosure({
  summary,
  defaultOpen = false,
  className,
  summaryClassName,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  /** Classes for the `<details>` box, e.g. `cardClasses()`. */
  className?: string;
  /** Extra classes for the summary row (padding, text size). */
  summaryClassName?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={className}>
      <summary
        className={[
          "flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden",
          summaryClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <span aria-hidden="true" className="shrink-0 text-muted transition-transform [details[open]>summary>&]:rotate-180">
          ▾
        </span>
      </summary>
      {children}
    </details>
  );
}
