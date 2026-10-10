import type { Language } from "@/lib/validation/task";

/**
 * Similar submissions (SPEC.md §8.9). Code is turned into tokens with comments removed and every name, string and
 * number replaced, so renaming variables or changing messages does not hide a copy; then k-gram fingerprints are
 * picked by winnowing. Intros are compared by five-word shingles. Similarity = shared / the smaller set (overlap
 * coefficient): unlike Jaccard, a copy with a few words changed or text added still scores high. The minimum sizes
 * below stop a tiny answer from matching a big one. A hint for the mentor, never a verdict.
 */

/** Pairs at or above this are reported. */
export const SIMILAR_PERCENT = 80;
/** Code shorter than this (in tokens) is not compared: short correct solutions all look alike. */
export const MIN_CODE_TOKENS = 60;
/** Intros shorter than this (in words) are not compared. */
export const MIN_INTRO_WORDS = 40;
/** At most this many pairs are stored per task, highest first. */
export const MAX_PAIRS = 50;

const CODE_K = 5;
const WINDOW = 4;
const INTRO_K = 5;

const KEYWORDS: Record<Language, ReadonlySet<string>> = {
  python: new Set(
    "and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print input range len int str float list dict set map".split(" "),
  ),
  cpp: new Set(
    "auto bool break case char class const continue default delete do double else enum false float for if include int long namespace new return short signed sizeof static std struct switch template true typedef unsigned using vector void while cin cout endl string main".split(" "),
  ),
  java: new Set(
    "boolean break case char class continue default do double else extends false final float for if import int long new null private public return short static String Scanner System switch this true void while main out println nextInt next".split(" "),
  ),
};

/** Strings, numbers, names, then any single non-space character. */
const TOKEN = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\d+(?:\.\d+)?|[A-Za-z_]\w*|\S/g;

function stripComments(code: string, language: Language): string {
  if (language === "python") {
    return code.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '""').replace(/#[^\n]*/g, "");
  }
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "").replace(/^\s*#[^\n]*/gm, "");
}

/** Code → normalised tokens: keywords and symbols kept, other names → `v`, strings → `s`, numbers → `n`. */
export function codeTokens(code: string, language: Language): string[] {
  const keywords = KEYWORDS[language];
  return (stripComments(code, language).match(TOKEN) ?? []).map((token) => {
    if (token.startsWith('"') || token.startsWith("'")) return "s";
    if (/^\d/.test(token)) return "n";
    if (/^[A-Za-z_]/.test(token)) return keywords.has(token) ? token : "v";
    return token;
  });
}

/** Intro → lower-case words without punctuation. */
export function introWords(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

/** 32-bit FNV-1a: stable across runs, which keeps the cron idempotent. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function kgramHashes(items: readonly string[], k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + k <= items.length; i++) out.push(hash(items.slice(i, i + k).join(" ")));
  return out;
}

/** Winnowing: the smallest hash of every window of `WINDOW` k-grams. */
export function codeFingerprints(tokens: readonly string[]): Set<number> {
  const hashes = kgramHashes(tokens, CODE_K);
  const picked = new Set<number>();
  for (let i = 0; i + WINDOW <= hashes.length; i++) picked.add(Math.min(...hashes.slice(i, i + WINDOW)));
  if (hashes.length > 0 && hashes.length < WINDOW) picked.add(Math.min(...hashes));
  return picked;
}

export function introShingles(words: readonly string[]): Set<number> {
  return new Set(kgramHashes(words, INTRO_K));
}

/** Shared fingerprints / the smaller set, as a whole percent. 0 when either side is empty. */
export function overlapPercent(a: ReadonlySet<number>, b: ReadonlySet<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared++;
  return Math.round((100 * shared) / Math.min(a.size, b.size));
}

export type SimilarityEntry = { submissionId: string; uid: string; content: string; language?: Language };
export type SimilarPair = { uidA: string; uidB: string; submissionIdA: string; submissionIdB: string; percent: number };

/**
 * Every pair of students (one entry each) at `SIMILAR_PERCENT` or more, highest first, at most `MAX_PAIRS`.
 * Code is only compared within one language. Order inside a pair follows the input order, so output is stable.
 */
/** Intros and scenario answers are both prose and are compared the same way. */
export function findSimilarPairs(type: "coding" | "intro_written" | "scenario", entries: readonly SimilarityEntry[]): SimilarPair[] {
  const prints = entries.flatMap((entry) => {
    if (type === "coding") {
      if (!entry.language) return [];
      const tokens = codeTokens(entry.content, entry.language);
      return tokens.length >= MIN_CODE_TOKENS ? [{ entry, set: codeFingerprints(tokens) }] : [];
    }
    const words = introWords(entry.content);
    return words.length >= MIN_INTRO_WORDS ? [{ entry, set: introShingles(words) }] : [];
  });

  const pairs: SimilarPair[] = [];
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i]!;
      const b = prints[j]!;
      if (a.entry.uid === b.entry.uid || a.entry.language !== b.entry.language) continue;
      const percent = overlapPercent(a.set, b.set);
      if (percent >= SIMILAR_PERCENT) {
        pairs.push({ uidA: a.entry.uid, uidB: b.entry.uid, submissionIdA: a.entry.submissionId, submissionIdB: b.entry.submissionId, percent });
      }
    }
  }
  return pairs.sort((x, y) => y.percent - x.percent).slice(0, MAX_PAIRS);
}
