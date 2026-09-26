import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";

const token = async () => "tok";

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("sends the bearer token and a JSON body, and returns parsed data", async () => {
    const fetchFn = mockFetch(async () => Response.json({ task: { id: "t1" } }, { status: 201 }));
    const result = await apiFetch(token, "/api/tasks", { method: "POST", body: { title: "x" } });
    expect(result).toEqual({ ok: true, data: { task: { id: "t1" } } });
    expect(fetchFn).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { authorization: "Bearer tok", "content-type": "application/json" },
      body: '{"title":"x"}',
    });
  });

  it("GETs without a body or content type by default", async () => {
    const fetchFn = mockFetch(async () => Response.json({ tasks: [] }));
    await apiFetch(token, "/api/tasks");
    expect(fetchFn).toHaveBeenCalledWith("/api/tasks", {
      method: "GET",
      headers: { authorization: "Bearer tok" },
      body: undefined,
    });
  });

  it("returns the server's error message", async () => {
    mockFetch(async () => Response.json({ error: "You do not have access to this." }, { status: 403 }));
    expect(await apiFetch(token, "/api/tasks")).toEqual({
      ok: false,
      status: 403,
      message: "You do not have access to this.",
    });
  });

  it("does not call the server when signed out", async () => {
    const fetchFn = mockFetch(async () => Response.json({}));
    expect(await apiFetch(async () => null, "/api/tasks")).toMatchObject({ ok: false, status: 401 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports network errors and non-JSON errors in plain English", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await apiFetch(token, "/api/tasks")).toMatchObject({ ok: false, status: 0 });
    mockFetch(async () => new Response("<html>", { status: 502 }));
    expect(await apiFetch(token, "/api/tasks")).toEqual({
      ok: false,
      status: 502,
      message: "Something went wrong. Please try again.",
    });
  });
});
