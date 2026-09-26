import { describe, expect, it, vi } from "vitest";
import { fetchProfile } from "@/lib/auth/fetchProfile";

const profile = {
  uid: "u1",
  name: "Stu",
  email: "stu@college.ac.in",
  role: "student",
  onboarded: false,
  showOnLeaderboard: false,
};

function fakeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fetchProfile", () => {
  it("POSTs to /api/me with the bearer token and returns the profile", async () => {
    const fetchFn = fakeFetch(200, { profile });
    expect(await fetchProfile("tok", fetchFn)).toEqual({ ok: true, profile });
    expect(fetchFn).toHaveBeenCalledWith("/api/me", { method: "POST", headers: { authorization: "Bearer tok" } });
  });

  it("passes the server's 403 message through (wrong domain)", async () => {
    const result = await fetchProfile("tok", fakeFetch(403, { error: "Please sign in with your college email." }));
    expect(result).toEqual({ ok: false, status: 403, message: "Please sign in with your college email." });
  });

  it("rejects a 200 reply with an invalid profile (e.g. unknown role)", async () => {
    const result = await fetchProfile("tok", fakeFetch(200, { profile: { ...profile, role: "admin" } }));
    expect(result.ok).toBe(false);
  });

  it("uses a generic message for non-JSON errors", async () => {
    const fetchFn = vi.fn(async () => new Response("<html>", { status: 502 })) as unknown as typeof fetch;
    expect(await fetchProfile("tok", fetchFn)).toEqual({
      ok: false,
      status: 502,
      message: "Something went wrong. Please try again.",
    });
  });

  it("reports network failures without throwing", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await fetchProfile("tok", fetchFn);
    expect(result).toMatchObject({ ok: false, status: 0 });
  });
});
