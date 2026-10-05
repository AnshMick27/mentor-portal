import type { IntegrityCounts, IntegrityFlag, StoredIntegrity } from "@/lib/validation/submission";

/**
 * Integrity flags (SPEC.md §8.9): hints for mentors, decided on the server, never used for the score. The counts
 * come from the browser, so every rule is generous; `elapsedMs` is measured on the server from the draft.
 */

/** Refused pastes before it is worth a look. */
export const PASTES_BLOCKED_LIMIT = 3;
/** Sustained typing (over 5 s) above this is faster than a person types. */
export const FAST_TYPING_CHARS_PER_SEC = 15;
/** The answer may be this much longer than what was typed (indent, own text moved) before it is flagged. */
export const TYPED_SLACK_CHARS = 50;
export const TYPED_SLACK_RATIO = 1.2;
/** Whole answer faster than this, measured from opening the form to submitting. */
export const QUICK_ANSWER_CHARS_PER_SEC = 10;
/** Short answers are never flagged as quick. */
export const QUICK_ANSWER_MIN_CHARS = 200;
/** Time away from the tab or window, in total. */
export const LONG_AWAY_MS = 5 * 60 * 1000;

export function integrityFlags(counts: IntegrityCounts | undefined, contentChars: number, elapsedMs?: number): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  if (!counts) flags.push("outside_form");
  else {
    if (counts.pastesBlocked >= PASTES_BLOCKED_LIMIT) flags.push("pastes_blocked");
    if (counts.maxCharsPerSec > FAST_TYPING_CHARS_PER_SEC) flags.push("fast_typing");
    if (contentChars > counts.typedChars * TYPED_SLACK_RATIO + TYPED_SLACK_CHARS) flags.push("more_than_typed");
  }
  if (elapsedMs !== undefined && contentChars >= QUICK_ANSWER_MIN_CHARS && contentChars > (elapsedMs / 1000) * QUICK_ANSWER_CHARS_PER_SEC) {
    flags.push("quick_answer");
  }
  if (counts && counts.awayMs >= LONG_AWAY_MS) flags.push("long_away");
  return flags;
}

/** What is stored on the submission: the counts (if any), the server-measured time, and the flags. */
export function buildIntegrity(counts: IntegrityCounts | undefined, contentChars: number, elapsedMs?: number): StoredIntegrity {
  return {
    ...counts,
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    flags: integrityFlags(counts, contentChars, elapsedMs),
  };
}
