import { StatusChip } from "@/components/ui/StatusChip";
import { INTEGRITY_FLAG_LABEL } from "@/lib/submissions/integrityDisplay";
import type { IntegrityFlag } from "@/lib/validation/submission";

/**
 * "Check" chip plus the reasons in one line (SPEC.md §8.9), for mentors and viewers only. The flags are hints from
 * the browser and the server's clock: the score is unchanged, the mentor decides. Nothing when there are no flags.
 */
export function IntegrityCheck({ flags }: { flags: readonly IntegrityFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <StatusChip tone="warning">Check</StatusChip>
      <span className="text-muted">{flags.map((flag) => INTEGRITY_FLAG_LABEL[flag]).join(" · ")}</span>
    </span>
  );
}
