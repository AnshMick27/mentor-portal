import ExcelJS from "exceljs";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/export/route";
import { XLSX_CONTENT_TYPE } from "@/lib/export/workbook";
import { fakeAdmin } from "../auth/fakeAdmin";

vi.mock("@/lib/firebase/admin", async () => (await import("../auth/fakeAdmin")).fakeAdmin.module);
vi.mock("@/lib/config/env", async () => {
  const { fakeEnv } = await import("../auth/fakeAdmin");
  return { getServerEnv: () => fakeEnv };
});

const SECRET = "SECRET-STUDENT-CONTENT";
const at = Timestamp.fromDate(new Date("2026-09-25T04:00:00Z"));

function request(token?: string): Request {
  return new Request("http://localhost/api/export", { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

/** Every cell value of every sheet, as text. */
async function allCells(response: Response): Promise<string[]> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.arrayBuffer());
  const cells: string[] = [];
  for (const sheet of book.worksheets) {
    sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
  }
  return cells;
}

beforeEach(() => {
  fakeAdmin.reset();
  const user = (role: string, extra: Record<string, unknown> = {}) => ({
    name: role,
    email: `${role}@college.ac.in`,
    role,
    onboarded: true,
    showOnLeaderboard: false,
    ...extra,
  });
  fakeAdmin.tokens.set("mentor", { uid: "m1", email: "ansh@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("viewer", { uid: "v1", email: "boss@college.ac.in", email_verified: true });
  fakeAdmin.tokens.set("student", { uid: "s1", email: "stu@college.ac.in", email_verified: true });
  fakeAdmin.users.set("m1", user("mentor"));
  fakeAdmin.users.set("v1", user("viewer"));
  fakeAdmin.users.set("s1", user("student", { name: "Asha Verma", rollNo: "0827CS1", branch: "CSE" }));
  fakeAdmin.users.set("s9", user("student", { name: "Not Onboarded", onboarded: false }));
  fakeAdmin.collection("tasks").set("t1", {
    title: "Resume review",
    type: "resume",
    description: "d",
    dueAt: at,
    status: "published",
    maxAttempts: 3,
    createdBy: "m1",
    createdAt: at,
    updatedAt: at,
  });
  fakeAdmin.collection("submissions").set("sub1", {
    taskId: "t1",
    uid: "s1",
    type: "resume",
    attempt: 1,
    createdAt: at,
    status: "done",
    content: SECRET,
    result: { score: 7.5, summary: "Solid.", strengths: [], improvements: [], nextSteps: [] },
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/export", () => {
  it("401s without a token and 403s students", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("student"))).status).toBe(403);
  });

  it("gives mentors and viewers an xlsx download named with the IST date", async () => {
    for (const token of ["mentor", "viewer"]) {
      const response = await GET(request(token));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(XLSX_CONTENT_TYPE);
      expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="mentor-portal-\d{4}-\d{2}-\d{2}\.xlsx"$/);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("contains onboarded students and their results, but never submission content", async () => {
    const cells = await allCells(await GET(request("mentor")));
    expect(cells).toContain("Asha Verma");
    expect(cells).toContain("Solid.");
    expect(cells).toContain("7.5");
    expect(cells).not.toContain("Not Onboarded");
    expect(cells.join("|")).not.toContain(SECRET);
  });

  it("leaves late attempts out of every sheet (T44)", async () => {
    fakeAdmin.collection("submissions").set("late1", {
      ...fakeAdmin.collection("submissions").get("sub1"),
      attempt: 2,
      late: true,
      result: { score: 9.9, summary: "Late but great.", strengths: [], improvements: [], nextSteps: [] },
    });
    const cells = await allCells(await GET(request("mentor")));
    expect(cells).toContain("7.5");
    expect(cells).not.toContain("9.9");
    expect(cells).not.toContain("Late but great.");
  });

  it("answers 500 with a plain message when Firestore fails", async () => {
    const db = fakeAdmin.module.getAdminDb();
    const original = db.collection;
    const spy = vi.spyOn(db, "collection").mockImplementation((name: string) => {
      if (name === "studentStats") throw new Error("Firestore down");
      return original(name);
    });
    const response = await GET(request("mentor"));
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not build the export. Please try again." });
  });
});
