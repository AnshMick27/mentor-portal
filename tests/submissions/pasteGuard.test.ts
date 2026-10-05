import { describe, expect, it } from "vitest";
import {
  changeBetween,
  createPasteGuard,
  MAX_TYPED_INSERT,
  PASTE_INPUT_TYPES,
  SPEED_WINDOW_MS,
  type BeforeInputInfo,
} from "@/lib/submissions/pasteGuard";

const typed = (inputType: string, text: string | null, extra: Partial<BeforeInputInfo> = {}): BeforeInputInfo => ({
  inputType,
  text,
  trusted: true,
  cancelable: true,
  ...extra,
});
const chars = (n: number) => "x".repeat(n);

describe("changeBetween", () => {
  it("finds an insert in the middle", () => {
    expect(changeBetween("ab", "aXYb")).toEqual({ inserted: "XY", removed: "" });
  });
  it("finds a replaced selection", () => {
    expect(changeBetween("hello world", "hello there")).toEqual({ inserted: "there", removed: "world" });
  });
  it("handles repeated letters without counting them twice", () => {
    expect(changeBetween("aa", "aaa")).toEqual({ inserted: "a", removed: "" });
  });
});

describe("paste and drop events", () => {
  it("refuses outside text and counts it", () => {
    const guard = createPasteGuard();
    expect(guard.paste("print(sum(map(int, input().split())))", true, "")).toBe(false);
    expect(guard.drop("from another app", true, "")).toBe(false);
    expect(guard.counts()).toMatchObject({ pastesBlocked: 2, largestInsert: 37 });
  });

  it("lets the student paste back text they copied or cut in this box", () => {
    const guard = createPasteGuard();
    guard.copied("def solve():\n    pass");
    expect(guard.paste("def solve():\n    pass", true, "")).toBe(true);
    expect(guard.beforeInput(typed("insertFromPaste", null), "")).toBe(false);
    expect(guard.change("", "def solve():\n    pass", true)).toBe(true);
    expect(guard.counts().pastesBlocked).toBe(0);
  });

  it("lets text already in the box be dropped or pasted (moving own lines)", () => {
    const guard = createPasteGuard();
    expect(guard.drop("x = int(input())", true, "x = int(input())\nprint(x)")).toBe(true);
  });

  it("refuses an untrusted (script) paste even of own text", () => {
    const guard = createPasteGuard();
    expect(guard.paste("abc", false, "abc")).toBe(false);
  });
});

describe("beforeinput", () => {
  it.each(PASTE_INPUT_TYPES)("cancels %s with outside text", (inputType) => {
    const guard = createPasteGuard();
    expect(guard.beforeInput(typed(inputType, "outside"), "")).toBe(true);
    expect(guard.counts().pastesBlocked).toBe(1);
  });

  it("cancels a paste type when the browser gives no text and no paste was allowed", () => {
    expect(createPasteGuard().beforeInput(typed("insertFromPaste", null), "")).toBe(true);
  });

  it("cancels a keyboard clipboard chip that arrives as one big insertText", () => {
    const guard = createPasteGuard();
    expect(guard.beforeInput(typed("insertText", chars(MAX_TYPED_INSERT + 1)), "")).toBe(true);
    expect(guard.beforeInput(typed("insertReplacementText", chars(MAX_TYPED_INSERT + 1)), "")).toBe(true);
  });

  it("allows normal typing, a predicted word and a spelling fix", () => {
    const guard = createPasteGuard();
    expect(guard.beforeInput(typed("insertText", "a"), "")).toBe(false);
    expect(guard.beforeInput(typed("insertText", "placement "), "")).toBe(false);
    expect(guard.beforeInput(typed("insertReplacementText", "received"), "")).toBe(false);
    expect(guard.beforeInput(typed("deleteContentBackward", null), "abc")).toBe(false);
    expect(guard.counts().pastesBlocked).toBe(0);
  });

  it("cancels untrusted input", () => {
    expect(createPasteGuard().beforeInput(typed("insertText", "a", { trusted: false }), "")).toBe(true);
  });

  it("leaves non-cancellable events (IME composition) to change, without counting", () => {
    const guard = createPasteGuard();
    expect(guard.beforeInput(typed("insertCompositionText", chars(40), { cancelable: false }), "")).toBe(false);
    expect(guard.counts().pastesBlocked).toBe(0);
  });
});

describe("change", () => {
  it(`accepts ${MAX_TYPED_INSERT} characters at once and refuses ${MAX_TYPED_INSERT + 1}`, () => {
    const guard = createPasteGuard();
    expect(guard.change("", chars(MAX_TYPED_INSERT), true)).toBe(true);
    expect(guard.change("", "y".repeat(MAX_TYPED_INSERT + 1), true)).toBe(false);
    expect(guard.counts()).toMatchObject({ pastesBlocked: 1, largestInsert: MAX_TYPED_INSERT + 1, typedChars: MAX_TYPED_INSERT });
  });

  it("measures the inserted part, not the length difference (paste over a selection)", () => {
    const guard = createPasteGuard();
    const before = "x = 1\n" + chars(30);
    expect(guard.change(before, "x = 1\n" + "y".repeat(30), true)).toBe(false);
  });

  it("counts typed characters across many small changes", () => {
    const guard = createPasteGuard();
    let value = "";
    for (const letter of "hello") {
      expect(guard.change(value, value + letter, true)).toBe(true);
      value += letter;
    }
    expect(guard.counts().typedChars).toBe(5);
  });

  it("lets a deleted block come back (undo)", () => {
    const guard = createPasteGuard();
    const block = "for i in range(n):\n    total += a[i]\n";
    expect(guard.change(block, "", true)).toBe(true);
    expect(guard.change("", block, true)).toBe(true);
  });

  it("lets the student duplicate a long line already in the box", () => {
    const line = "print(solve(read_numbers()))\n";
    expect(createPasteGuard().change(line, line + line, true)).toBe(true);
  });

  it("refuses an untrusted change of any size", () => {
    expect(createPasteGuard().change("", "a", false)).toBe(false);
  });
});

describe("typing speed (T46b)", () => {
  function typeAt(guard: ReturnType<typeof createPasteGuard>, advance: (ms: number) => void, letters: number, gapMs: number) {
    let value = "";
    for (let i = 0; i < letters; i++) {
      advance(gapMs);
      guard.change(value, value + "a", true);
      value += "a";
    }
  }
  function clock() {
    let now = 0;
    return { now: () => now, advance: (ms: number) => void (now += ms) };
  }

  it("measures a steady typist at about 5 characters a second", () => {
    const c = clock();
    const guard = createPasteGuard(c.now);
    typeAt(guard, c.advance, 100, 200);
    expect(guard.counts().maxCharsPerSec).toBeCloseTo(5, 0);
  });

  it(`averages over ${SPEED_WINDOW_MS / 1000} s, so a short burst stays low`, () => {
    const c = clock();
    const guard = createPasteGuard(c.now);
    typeAt(guard, c.advance, 10, 20); // 10 letters in 0.2 s
    expect(guard.counts().maxCharsPerSec).toBe(2);
  });

  it("sees an auto-typer that types 40 characters a second", () => {
    const c = clock();
    const guard = createPasteGuard(c.now);
    typeAt(guard, c.advance, 400, 25);
    expect(guard.counts().maxCharsPerSec).toBeGreaterThan(30);
  });

  it("counts Tab indents as typed", () => {
    const guard = createPasteGuard();
    guard.addTyped(4);
    guard.addTyped(0);
    expect(guard.counts().typedChars).toBe(4);
  });
});
