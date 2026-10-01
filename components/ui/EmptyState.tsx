import type { ReactNode } from "react";

/** "Nothing here yet" in muted text, optionally with the one action that fixes it (docs/UX_REVIEW.md UX-25). */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  if (!action) return <p className="text-sm text-muted">{children}</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted">{children}</p>
      {action}
    </div>
  );
}
