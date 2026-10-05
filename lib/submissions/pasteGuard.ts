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

export type PasteCounts = {
  /** User actions that tried to put outside text in and were refused. */
  pastesBlocked: number;
  /** Largest single insert attempted, refused or not. */
  largestInsert: number;
  /** Characters added by accepted changes. */
  typedChars: number;
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
  counts(): PasteCounts;
};

export function createPasteGuard(): PasteGuard {
  const counts: PasteCounts = { pastesBlocked: 0, largestInsert: 0, typedChars: 0 };
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
      counts.typedChars += inserted.length;
      return true;
    },
    copied: remember,
    counts: () => ({ ...counts }),
  };
}
