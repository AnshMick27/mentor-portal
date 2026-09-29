import { MAX_INTRO_CHARS, MIN_INTRO_CHARS } from "./limits";

/** SPEC.md §8.4: the written intro should be 80–250 words (advice only; the server enforces characters). */
export const INTRO_TARGET_MIN_WORDS = 80;
export const INTRO_TARGET_MAX_WORDS = 250;

/** Words = runs of non-whitespace characters. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export type IntroLengthCheck = {
  words: number;
  chars: number;
  /** Plain-English hint about the word target. */
  wordHint: string;
  wordsInTarget: boolean;
  /** Set when the trimmed text breaks the server's character limit, so Submit must stay disabled. */
  charError?: string;
};

/** Live word/char feedback for the intro box. Characters are counted after trimming, like the server does. */
export function checkIntroLength(text: string): IntroLengthCheck {
  const words = countWords(text);
  const chars = text.trim().length;
  const wordsInTarget = words >= INTRO_TARGET_MIN_WORDS && words <= INTRO_TARGET_MAX_WORDS;
  const wordHint =
    words < INTRO_TARGET_MIN_WORDS
      ? `Aim for at least ${INTRO_TARGET_MIN_WORDS} words.`
      : words > INTRO_TARGET_MAX_WORDS
        ? `Try to keep it under ${INTRO_TARGET_MAX_WORDS} words.`
        : "Good length.";
  let charError: string | undefined;
  if (chars < MIN_INTRO_CHARS) charError = `Write at least ${MIN_INTRO_CHARS} characters (${chars} so far).`;
  else if (chars > MAX_INTRO_CHARS) charError = `Keep it to ${MAX_INTRO_CHARS.toLocaleString("en-IN")} characters (${chars} now).`;
  return { words, chars, wordHint, wordsInTarget, charError };
}
