/**
 * Counts how often and how long the student left the page while a code or intro form was open (SPEC.md §8.9):
 * another tab, another window or another app on a phone. Framework-free; `useIntegrity` feeds it browser events.
 */
export type AwayTracker = {
  /** Window blur or page hidden. Repeated calls while already away are ignored. */
  away(): void;
  /** Window focus or page visible again. */
  back(): void;
  /** Totals so far, including a time away that has not ended yet. */
  counts(): { awayCount: number; awayMs: number };
};

export function createAwayTracker(clock: () => number = Date.now): AwayTracker {
  let awayCount = 0;
  let awayMs = 0;
  let since: number | undefined;
  return {
    away() {
      if (since !== undefined) return;
      since = clock();
      awayCount++;
    },
    back() {
      if (since === undefined) return;
      awayMs += clock() - since;
      since = undefined;
    },
    counts: () => ({ awayCount, awayMs: Math.round(awayMs + (since === undefined ? 0 : clock() - since)) }),
  };
}
