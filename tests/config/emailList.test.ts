import { describe, expect, it } from "vitest";
import { parseEmailList } from "@/lib/config/emailList";

describe("parseEmailList", () => {
  it("returns an empty set for undefined or blank input", () => {
    expect(parseEmailList(undefined).size).toBe(0);
    expect(parseEmailList("").size).toBe(0);
    expect(parseEmailList("  , ,").size).toBe(0);
  });

  it("splits on commas, trims and lowercases", () => {
    const emails = parseEmailList(" Ansh@College.ac.in, mentor2@college.ac.in ,");
    expect([...emails]).toEqual(["ansh@college.ac.in", "mentor2@college.ac.in"]);
  });

  it("removes duplicates that differ only in case or spacing", () => {
    expect(parseEmailList("a@x.in,A@X.IN, a@x.in ").size).toBe(1);
  });

  it("supports membership checks against lowercased emails", () => {
    expect(parseEmailList("Boss@College.ac.in").has("boss@college.ac.in")).toBe(true);
  });
});
