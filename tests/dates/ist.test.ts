import { describe, expect, it } from "vitest";
import { formatIst, fromIstInputValue, toIstInputValue } from "@/lib/dates/ist";

describe("formatIst", () => {
  it("shows UTC instants in IST with the IST label", () => {
    expect(formatIst("2026-10-05T18:29:00Z")).toBe("5 Oct 2026, 11:59 pm IST");
    expect(formatIst("2026-10-05T23:59:00+05:30")).toBe("5 Oct 2026, 11:59 pm IST");
  });

  it("crosses the date line correctly (UTC evening is next morning in IST)", () => {
    expect(formatIst("2026-12-31T20:00:00Z")).toBe("1 Jan 2027, 1:30 am IST");
  });

  it("shows a dash for invalid dates", () => {
    expect(formatIst("not a date")).toBe("—");
  });
});

describe("IST datetime-local conversion", () => {
  it("converts an instant to the IST wall-clock input value", () => {
    expect(toIstInputValue("2026-10-05T18:29:00Z")).toBe("2026-10-05T23:59");
    expect(toIstInputValue("2026-12-31T20:00:00.000Z")).toBe("2027-01-01T01:30");
    expect(toIstInputValue("junk")).toBe("");
  });

  it("reads input values as IST, independent of the machine's time zone", () => {
    expect(fromIstInputValue("2026-10-05T23:59")).toBe("2026-10-05T23:59:00+05:30");
    expect(new Date(fromIstInputValue("2026-10-05T23:59") ?? "").toISOString()).toBe("2026-10-05T18:29:00.000Z");
  });

  it("round-trips", () => {
    const value = "2026-03-01T00:15";
    expect(toIstInputValue(fromIstInputValue(value) ?? "")).toBe(value);
  });

  it("rejects blank, malformed and impossible values", () => {
    for (const value of ["", "2026-10-05", "2026-10-05 23:59", "2026-02-31T10:00", "2026-13-01T10:00", "2026-10-05T24:30"]) {
      expect(fromIstInputValue(value), value).toBeUndefined();
    }
  });
});
