import { describe, expect, it } from "vitest";
import {
  buildIntegrity,
  FAST_TYPING_CHARS_PER_SEC,
  integrityFlags,
  LONG_AWAY_MS,
  PASTES_BLOCKED_LIMIT,
  QUICK_ANSWER_MIN_CHARS,
} from "@/lib/submissions/integrityFlags";
import { integrityCountsSchema, storedIntegritySchema, type IntegrityCounts } from "@/lib/validation/submission";

const clean: IntegrityCounts = { pastesBlocked: 0, largestInsert: 4, typedChars: 600, awayCount: 1, awayMs: 20_000, maxCharsPerSec: 4 };
const MINUTE = 60_000;

describe("integrityFlags", () => {
  it("raises nothing for an answer typed in the form at a normal speed", () => {
    expect(integrityFlags(clean, 500, 10 * MINUTE)).toEqual([]);
  });

  it("flags an answer sent without counts (outside the form)", () => {
    expect(integrityFlags(undefined, 500)).toEqual(["outside_form"]);
  });

  it(`flags ${PASTES_BLOCKED_LIMIT} or more refused pastes, not fewer`, () => {
    expect(integrityFlags({ ...clean, pastesBlocked: PASTES_BLOCKED_LIMIT - 1 }, 500)).toEqual([]);
    expect(integrityFlags({ ...clean, pastesBlocked: PASTES_BLOCKED_LIMIT }, 500)).toEqual(["pastes_blocked"]);
  });

  it("flags typing faster than a person types", () => {
    expect(integrityFlags({ ...clean, maxCharsPerSec: FAST_TYPING_CHARS_PER_SEC }, 500)).toEqual([]);
    expect(integrityFlags({ ...clean, maxCharsPerSec: FAST_TYPING_CHARS_PER_SEC + 0.1 }, 500)).toEqual(["fast_typing"]);
  });

  it("flags an answer much longer than what was typed, with slack for indents and moved lines", () => {
    expect(integrityFlags({ ...clean, typedChars: 500 }, 650)).toEqual([]); // 500 * 1.2 + 50 = 650
    expect(integrityFlags({ ...clean, typedChars: 500 }, 651)).toEqual(["more_than_typed"]);
    expect(integrityFlags({ ...clean, typedChars: 0 }, 51)).toEqual(["more_than_typed"]);
  });

  it("flags a long answer sent soon after the form opened, using the server's time", () => {
    expect(integrityFlags(clean, 600, 60_000)).toEqual([]); // 10 chars/s exactly
    expect(integrityFlags(clean, 600, 59_000)).toEqual(["quick_answer"]);
    expect(integrityFlags(undefined, 600, 5_000)).toEqual(["outside_form", "quick_answer"]);
  });

  it("never flags a short answer as quick, and skips the rule without a draft", () => {
    expect(integrityFlags(clean, QUICK_ANSWER_MIN_CHARS - 1, 1_000)).toEqual([]);
    expect(integrityFlags(clean, 600, undefined)).toEqual([]);
  });

  it("flags a long time away from the page", () => {
    expect(integrityFlags({ ...clean, awayMs: LONG_AWAY_MS - 1 }, 500)).toEqual([]);
    expect(integrityFlags({ ...clean, awayMs: LONG_AWAY_MS, awayCount: 4 }, 500)).toEqual(["long_away"]);
  });
});

describe("buildIntegrity", () => {
  it("stores the counts, the server time and the flags in the stored shape", () => {
    const stored = buildIntegrity(clean, 500, 10 * MINUTE);
    expect(stored).toEqual({ ...clean, elapsedMs: 10 * MINUTE, flags: [] });
    expect(storedIntegritySchema.parse(stored)).toEqual(stored);
  });

  it("stores only the flags (and time) when there are no counts", () => {
    expect(buildIntegrity(undefined, 500)).toEqual({ flags: ["outside_form"] });
  });
});

describe("integrityCountsSchema", () => {
  it("rejects negative, fractional or unknown counts", () => {
    expect(integrityCountsSchema.safeParse({ ...clean, pastesBlocked: -1 }).success).toBe(false);
    expect(integrityCountsSchema.safeParse({ ...clean, typedChars: 1.5 }).success).toBe(false);
    expect(integrityCountsSchema.safeParse({ ...clean, keystrokes: "abc" }).success).toBe(false);
  });
});
