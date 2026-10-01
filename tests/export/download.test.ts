import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EXPORT_FILENAME, fetchExport, filenameFromDisposition } from "@/lib/export/download";

describe("filenameFromDisposition", () => {
  it("takes a plain xlsx filename and refuses anything else", () => {
    expect(filenameFromDisposition('attachment; filename="mentor-portal-2026-10-01.xlsx"')).toBe("mentor-portal-2026-10-01.xlsx");
    expect(filenameFromDisposition('attachment; filename="../evil.exe"')).toBe(DEFAULT_EXPORT_FILENAME);
    expect(filenameFromDisposition(null)).toBe(DEFAULT_EXPORT_FILENAME);
  });
});

describe("fetchExport", () => {
  const token = async () => "tok";

  it("sends the ID token and returns the file", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-disposition": 'attachment; filename="mentor-portal-2026-10-01.xlsx"' },
      }),
    );
    const result = await fetchExport(token, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith("/api/export", { headers: { authorization: "Bearer tok" } });
    expect(result.ok && result.filename).toBe("mentor-portal-2026-10-01.xlsx");
    expect(result.ok && result.blob.size).toBe(3);
  });

  it("passes on the server's message, and handles sign-out and network errors", async () => {
    const refused = vi.fn(async () => Response.json({ error: "Forbidden." }, { status: 403 }));
    expect(await fetchExport(token, refused)).toEqual({ ok: false, message: "Forbidden." });
    expect(await fetchExport(async () => null, refused)).toEqual({ ok: false, message: "Please sign in again." });
    const offline = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect((await fetchExport(token, offline)).ok).toBe(false);
  });
});
