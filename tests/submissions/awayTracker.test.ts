import { describe, expect, it } from "vitest";
import { createAwayTracker } from "@/lib/submissions/awayTracker";

function clockAt(start = 0) {
  let now = start;
  return { clock: () => now, advance: (ms: number) => (now += ms) };
}

describe("createAwayTracker", () => {
  it("counts each time away once, even when blur and hidden both fire", () => {
    const { clock, advance } = clockAt();
    const tracker = createAwayTracker(clock);
    tracker.away();
    tracker.away(); // page hidden after the window blur
    advance(3_000);
    tracker.back();
    tracker.back(); // focus after visible
    expect(tracker.counts()).toEqual({ awayCount: 1, awayMs: 3_000 });
  });

  it("adds up several times away", () => {
    const { clock, advance } = clockAt();
    const tracker = createAwayTracker(clock);
    for (const ms of [1_000, 2_000, 4_000]) {
      tracker.away();
      advance(ms);
      tracker.back();
      advance(10_000);
    }
    expect(tracker.counts()).toEqual({ awayCount: 3, awayMs: 7_000 });
  });

  it("includes a time away that has not ended yet", () => {
    const { clock, advance } = clockAt();
    const tracker = createAwayTracker(clock);
    tracker.away();
    advance(5_000);
    expect(tracker.counts()).toEqual({ awayCount: 1, awayMs: 5_000 });
  });

  it("ignores coming back without having left", () => {
    const tracker = createAwayTracker(clockAt().clock);
    tracker.back();
    expect(tracker.counts()).toEqual({ awayCount: 0, awayMs: 0 });
  });
});
