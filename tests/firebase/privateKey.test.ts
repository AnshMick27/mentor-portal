import { describe, expect, it } from "vitest";
import { normalizePrivateKey } from "@/lib/firebase/privateKey";

const PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\nkqhkiG9w0BAQEF\n-----END PRIVATE KEY-----\n";

describe("normalizePrivateKey", () => {
  it("turns literal \\n sequences into real newlines (Vercel / unquoted .env form)", () => {
    const literal = PEM.replace(/\n/g, "\\n");
    expect(literal).not.toContain("\n");
    expect(normalizePrivateKey(literal)).toBe(PEM);
  });

  it("leaves a key that already has real newlines unchanged", () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM);
  });

  it("strips surrounding double or single quotes", () => {
    expect(normalizePrivateKey(`"${PEM.replace(/\n/g, "\\n")}"`)).toBe(PEM);
    expect(normalizePrivateKey(`'${PEM}'`)).toBe(PEM);
  });

  it("normalises Windows line endings and surrounding whitespace", () => {
    expect(normalizePrivateKey(`  ${PEM.replace(/\n/g, "\r\n")}  `)).toBe(PEM);
    expect(normalizePrivateKey(PEM.replace(/\n/g, "\\r\\n"))).toBe(PEM);
  });

  it("adds exactly one trailing newline", () => {
    expect(normalizePrivateKey(PEM.trimEnd())).toBe(PEM);
    expect(normalizePrivateKey(`${PEM}\n\n`)).toBe(PEM);
  });
});
