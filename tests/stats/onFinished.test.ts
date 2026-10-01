import { beforeEach, describe, expect, it, vi } from "vitest";
import { recomputeAll, recomputeAllAfter, recomputeStudent, recomputeTask } from "@/lib/stats/recompute";
import { onFinished } from "@/lib/submissions/onFinished";

// The real recompute module, but every Firestore call fails: onFinished and recomputeAllAfter must not throw.
vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => {
    throw new Error("Firestore is down");
  },
}));

const sub = { submissionId: "sub1", uid: "s1", taskId: "t1" };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("onFinished", () => {
  it("logs recompute failures instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(recomputeStudent("s1")).rejects.toThrow("Firestore is down");
    await expect(recomputeTask("t1")).rejects.toThrow("Firestore is down");
    await expect(onFinished(sub)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0]?.[0])).toContain("submissions/sub1");
  });
});

describe("recomputeAllAfter", () => {
  it("logs a failed full recompute instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(recomputeAll()).rejects.toThrow("Firestore is down");
    await expect(recomputeAllAfter("PATCH /api/tasks/t1")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).toContain("PATCH /api/tasks/t1");
  });
});
