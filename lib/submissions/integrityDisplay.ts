import { INTEGRITY_FLAGS, type IntegrityFlag, type StoredIntegrity } from "@/lib/validation/submission";

/** Plain words for each flag (SPEC.md §8.9). Mentors and viewers only; students never see these. */
export const INTEGRITY_FLAG_LABEL: Record<IntegrityFlag, string> = {
  outside_form: "Sent outside the form",
  pastes_blocked: "Tried to paste several times",
  fast_typing: "Typed faster than a person can",
  more_than_typed: "Answer longer than what was typed",
  quick_answer: "Finished very soon after opening",
  long_away: "Away from the page 5+ minutes",
};

/** The flags of several attempts, each once, in a fixed order. */
export function flagsAcross(attempts: readonly { integrity?: StoredIntegrity }[]): IntegrityFlag[] {
  const seen = new Set(attempts.flatMap((attempt) => attempt.integrity?.flags ?? []));
  return INTEGRITY_FLAGS.filter((flag) => seen.has(flag));
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** One line of the numbers behind the flags, e.g. "Typed 450 characters · 1 paste refused · Took 5 min". */
export function integrityDetails(integrity: StoredIntegrity): string {
  const parts: string[] = [];
  if (integrity.typedChars === undefined) parts.push("No typing counts (not sent from the form)");
  else {
    parts.push(`Typed ${plural(integrity.typedChars, "character", "characters")}`);
    parts.push(plural(integrity.pastesBlocked ?? 0, "paste refused", "pastes refused"));
    if ((integrity.awayCount ?? 0) > 0) parts.push(`Away ${plural(integrity.awayCount ?? 0, "time", "times")} (${duration(integrity.awayMs ?? 0)})`);
    parts.push(`Top speed ${integrity.maxCharsPerSec ?? 0} characters/s`);
  }
  if (integrity.elapsedMs !== undefined) parts.push(`Took ${duration(integrity.elapsedMs)}`);
  return parts.join(" · ");
}
