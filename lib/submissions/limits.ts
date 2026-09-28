/** Server-enforced submission limits (SPEC.md §7.8). Shared by the API schemas and the submit forms. */

/** Source code: at most 32 KB, measured in UTF-8 bytes. */
export const MAX_CODE_BYTES = 32 * 1024;

/** Resume text: at most 12,000 characters. */
export const MAX_RESUME_CHARS = 12_000;

/** Written intro: 300–2,500 characters. */
export const MIN_INTRO_CHARS = 300;
export const MAX_INTRO_CHARS = 2_500;

/** SPEC.md §9.5: a submission still queued/running after this long counts as an error. */
export const JUDGE_TIMEOUT_MS = 10 * 60 * 1000;
export const TIMED_OUT_ERROR = "Judge timed out, attempt not counted";

/** Size of `text` in UTF-8 bytes (what the 32 KB code limit counts). */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
