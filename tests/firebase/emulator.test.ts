import { describe, expect, it } from "vitest";
import { shouldUseEmulator } from "@/lib/firebase/emulator";

describe("shouldUseEmulator", () => {
  it("is on only when the flag is true outside production", () => {
    expect(shouldUseEmulator("true", "development")).toBe(true);
    expect(shouldUseEmulator(" TRUE ", "test")).toBe(true);
  });

  it("is never on in production, even if the flag is set", () => {
    expect(shouldUseEmulator("true", "production")).toBe(false);
  });

  it("is off when the flag is missing or not exactly true", () => {
    expect(shouldUseEmulator(undefined, "development")).toBe(false);
    expect(shouldUseEmulator("", "development")).toBe(false);
    expect(shouldUseEmulator("false", "development")).toBe(false);
    expect(shouldUseEmulator("1", "development")).toBe(false);
  });
});
