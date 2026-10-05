/**
 * Paste block for the code and intro boxes (SPEC.md §8.9). Framework-free so it can be unit-tested; the React side
 * is `components/student/usePasteGuard.ts`.
 *
 * Text from outside the box is refused. Text the student already had in this box (copied, cut or deleted here)
 * may come back, so moving their own lines or undoing a deletion still works.
 */

/** A single change may add at most this many characters. Phone-keyboard clipboard chips arrive as typing, not paste. */
export const MAX_TYPED_INSERT = 25;

/** `beforeinput` types that put outside text into the box. */
export const PASTE_INPUT_TYPES: readonly string[] = ["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop", "insertFromYank"];

/** Remembered own text is capped so a long session cannot grow it without limit. */
const OWN_TEXT_CAP = 64_000;

/** Typing speed is measured over this window, so one quick burst does not count as fast typing. */
export const SPEED_WINDOW_MS = 5_000;

export type PasteCounts = {
  /** User actions that tried to put outside text in and were refused. */
  pastesBlocked: number;
  /** Largest single insert attempted, refused or not. */
  largestInsert: number;
  /** Characters added by accepted changes (and Tab indents). */
  typedChars: number;
  /** Most characters added in any 5-second window, per second. */
  maxCharsPerSec: number;
};

/** The part of `next` that is not in `prev`, found by trimming the common start and end. */
export function changeBetween(prev: string, next: string): { inserted: string; removed: string } {
  let start = 0;
  const shortest = Math.min(prev.length, next.length);
  while (start < shortest && prev[start] === next[start]) start++;
  let end = 0;
  while (end < shortest - start && prev[prev.length - 1 - end] === next[next.length - 1 - end]) end++;
  return { inserted: next.slice(start, next.length - end), removed: prev.slice(start, prev.length - end) };
}

export type BeforeInputInfo = {
  inputType: string;
  /** `data`, or the plain text of `dataTransfer`; null when the browser does not say. */
  text: string | null;
  trusted: boolean;
  cancelable: boolean;
};

export type PasteGuard = {
  /** `paste` event. Returns true to let it through. */
  paste(text: string, trusted: boolean, current: string): boolean;
  /** `drop` event. Returns true to let it through. */
  drop(text: string, trusted: boolean, current: string): boolean;
  /** Native `beforeinput`. Returns true when the event must be cancelled. */
  beforeInput(info: BeforeInputInfo, current: string): boolean;
  /** `change` (React `onChange`). Returns true to accept `next`; false keeps `prev`. */
  change(prev: string, next: string, trusted: boolean): boolean;
  /** `copy` / `cut` inside the box: that text may be pasted back. */
  copied(text: string): void;
  /** Text the form itself added for a key press (Tab indent), counted as typed. */
  addTyped(length: number): void;
  counts(): PasteCounts;
};

/** `clock` returns milliseconds; injectable for tests. */
export function createPasteGuard(clock: () => number = Date.now): PasteGuard {
  const counts: PasteCounts = { pastesBlocked: 0, largestInsert: 0, typedChars: 0, maxCharsPerSec: 0 };
  // Recent accepted inserts, oldest first, for the typing-speed window.
  const recent: { at: number; length: number }[] = [];
  let ownText = "";
  // A paste we let through: its `beforeinput` may carry no text, so it is matched by this flag.
  let pasteAllowed = false;

  const remember = (text: string) => {
    if (text === "") return;
    ownText = (ownText + "\n" + text).slice(-OWN_TEXT_CAP);
  };
  const isOwn = (text: string, current: string) => text === "" || current.includes(text) || ownText.includes(text);
  const noteSize = (length: number) => {
    counts.largestInsert = Math.max(counts.largestInsert, length);
  };
  const typed = (length: number) => {
    if (length === 0) return;
    counts.typedChars += length;
    const at = clock();
    recent.push({ at, length });
    while (recent.length > 0 && (recent[0]?.at ?? at) <= at - SPEED_WINDOW_MS) recent.shift();
    const inWindow = recent.reduce((sum, entry) => sum + entry.length, 0);
    counts.maxCharsPerSec = Math.max(counts.maxCharsPerSec, Math.round((inWindow / (SPEED_WINDOW_MS / 1000)) * 10) / 10);
  };
  const refuse = () => {
    counts.pastesBlocked++;
    return false;
  };

  function transfer(text: string, trusted: boolean, current: string): boolean {
    noteSize(text.length);
    pasteAllowed = trusted && isOwn(text, current);
    return pasteAllowed || refuse();
  }

  return {
    paste: transfer,
    drop: transfer,
    beforeInput({ inputType, text, trusted, cancelable }, current) {
      // Not cancellable (e.g. IME composition): `change` decides instead, so nothing is counted twice.
      if (!cancelable) return false;
      const pasteType = PASTE_INPUT_TYPES.includes(inputType);
      if (pasteType && pasteAllowed) {
        pasteAllowed = false;
        return false;
      }
      const block = !trusted || (pasteType ? text === null || !isOwn(text, current) : text !== null && text.length > MAX_TYPED_INSERT && !isOwn(text, current));
      if (block) {
        if (text !== null) noteSize(text.length);
        refuse();
      }
      return block;
    },
    change(prev, next, trusted) {
      const { inserted, removed } = changeBetween(prev, next);
      noteSize(inserted.length);
      if (!trusted || (inserted.length > MAX_TYPED_INSERT && !isOwn(inserted, prev))) return refuse();
      remember(removed);
      typed(inserted.length);
      return true;
    },
    copied: remember,
    addTyped: typed,
    counts: () => ({ ...counts }),
  };
}
