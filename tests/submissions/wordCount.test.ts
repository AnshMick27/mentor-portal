import { describe, expect, it } from "vitest";
import { MAX_INTRO_CHARS, MIN_INTRO_CHARS } from "@/lib/submissions/limits";
import { checkIntroLength, countWords } from "@/lib/submissions/wordCount";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("countWords", () => {
  it("counts runs of non-whitespace, ignoring extra spaces, tabs and newlines", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
    expect(countWords("Hello")).toBe(1);
    expect(countWords("  Hello,   I am\nAnsh.\t\tThanks  ")).toBe(5);
  });
});

describe("checkIntroLength", () => {
  it("hints below, inside and above the 80–250 word target", () => {
    expect(checkIntroLength(words(79))).toMatchObject({ words: 79, wordsInTarget: false, wordHint: "Aim for at least 80 words." });
    expect(checkIntroLength(words(80))).toMatchObject({ wordsInTarget: true, wordHint: "Good length." });
    expect(checkIntroLength(words(250))).toMatchObject({ wordsInTarget: true });
    expect(checkIntroLength(words(251))).toMatchObject({ wordsInTarget: false, wordHint: "Try to keep it under 250 words." });
  });

  it("applies the server's 300–2,500 character limit to the trimmed text", () => {
    expect(checkIntroLength("a".repeat(MIN_INTRO_CHARS - 1)).charError).toContain("at least 300");
    expect(checkIntroLength(`  ${"a".repeat(MIN_INTRO_CHARS - 1)}  `).charError).toBeDefined();
    expect(checkIntroLength("a".repeat(MIN_INTRO_CHARS)).charError).toBeUndefined();
    expect(checkIntroLength("a".repeat(MAX_INTRO_CHARS)).charError).toBeUndefined();
    expect(checkIntroLength("a".repeat(MAX_INTRO_CHARS + 1)).charError).toContain("2,500");
  });
});
