import { describe, expect, it } from "vitest";
import { buildSeedData, emulatorHosts } from "../../scripts/seedData.mts";
import { onboardingSchema } from "@/lib/validation/onboarding";

const now = new Date("2026-09-26T12:00:00+05:30");
const data = buildSeedData("college.ac.in", now);

describe("emulatorHosts (seed safety guard)", () => {
  it("defaults to the local emulator ports from firebase.json", () => {
    expect(emulatorHosts({})).toEqual({ firestore: "127.0.0.1:8080", auth: "127.0.0.1:9099" });
  });

  it("accepts explicit local hosts", () => {
    expect(emulatorHosts({ FIRESTORE_EMULATOR_HOST: "localhost:8181", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199" })).toEqual({
      firestore: "localhost:8181",
      auth: "127.0.0.1:9199",
    });
  });

  it("refuses any non-local host", () => {
    expect(() => emulatorHosts({ FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" })).toThrow(/Refusing to seed/);
    expect(() => emulatorHosts({ FIREBASE_AUTH_EMULATOR_HOST: "10.0.0.5:9099" })).toThrow(/Refusing to seed/);
  });
});

describe("buildSeedData", () => {
  it("has 1 mentor, 1 viewer and 6 students, all on the allowed domain", () => {
    const roles = data.users.map((u) => u.doc.role);
    expect(roles.filter((r) => r === "mentor")).toHaveLength(1);
    expect(roles.filter((r) => r === "viewer")).toHaveLength(1);
    expect(roles.filter((r) => r === "student")).toHaveLength(6);
    for (const { doc } of data.users) expect(doc.email.endsWith("@college.ac.in")).toBe(true);
  });

  it("has unique uids, emails and roll numbers", () => {
    const unique = (values: unknown[]) => new Set(values).size === values.length;
    expect(unique(data.users.map((u) => u.uid))).toBe(true);
    expect(unique(data.users.map((u) => u.doc.email))).toBe(true);
    expect(unique(data.users.map((u) => u.doc.rollNo).filter(Boolean))).toBe(true);
  });

  it("gives every student valid onboarding details across at least 4 branches, plus a stats doc", () => {
    const students = data.users.filter((u) => u.doc.role === "student");
    for (const { doc } of students) {
      expect(doc.onboarded).toBe(true);
      expect(onboardingSchema.safeParse({ rollNo: doc.rollNo, branch: doc.branch }).success).toBe(true);
    }
    expect(new Set(students.map((s) => s.doc.branch)).size).toBeGreaterThanOrEqual(4);
    expect(data.studentStats.map((s) => s.uid)).toEqual(students.map((s) => s.uid));
  });

  it("has 4 tasks: 2 published upcoming, 1 draft, 1 published past due", () => {
    const due = (iso: string) => Date.parse(iso) > now.getTime();
    const { tasks } = data;
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((t) => t.task.status === "published" && due(t.task.dueAt))).toHaveLength(2);
    expect(tasks.filter((t) => t.task.status === "draft")).toHaveLength(1);
    expect(tasks.filter((t) => t.task.status === "published" && !due(t.task.dueAt))).toHaveLength(1);
  });

  it("includes a coding task with sample tests and applies default attempts", () => {
    const coding = data.tasks.find((t) => t.task.type === "coding");
    expect(coding?.task.coding?.sampleTests.length).toBeGreaterThan(0);
    expect(coding?.task.maxAttempts).toBe(5);
  });

  it("sets due dates at 23:59 IST relative to now", () => {
    expect(data.tasks.find((t) => t.id === "seed-two-sum")?.task.dueAt).toBe("2026-10-01T23:59:00+05:30");
    expect(data.tasks.find((t) => t.id === "seed-intro-past")?.task.dueAt).toBe("2026-09-23T23:59:00+05:30");
  });
});
