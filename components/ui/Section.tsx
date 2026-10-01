import { useId, type ReactNode } from "react";

/**
 * A titled block of a page (docs/UX_REVIEW.md §3.2). Named by its visible heading via `aria-labelledby`, so screen
 * readers hear the name once (an extra `aria-label` made them hear it twice).
 */
export function Section({
  title,
  count,
  action,
  level = 2,
  className,
  children,
}: {
  title: string;
  /** Shown after the title in muted text, e.g. "(12)". */
  count?: number;
  /** A small link or button on the right of the heading, e.g. "All tasks". */
  action?: ReactNode;
  level?: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className={["flex flex-col gap-3", className].filter(Boolean).join(" ")}>
      <div className="flex items-baseline justify-between gap-3">
        <Heading id={id} className={level === 2 ? "text-lg font-semibold" : "text-base font-semibold"}>
          {title}
          {count !== undefined && (
            <>
              {" "}
              <span className="text-sm font-normal text-muted">({count})</span>
            </>
          )}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}
