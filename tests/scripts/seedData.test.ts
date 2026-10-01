import { describe, expect, it } from "vitest";
import { buildSeedData, emulatorHosts } from "../../scripts/seedData.mts";
import { attemptsUsed } from "@/lib/submissions/scoring";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { storedStudentStatsSchema, storedTaskStatsSchema } from "@/lib/validation/stats";
import { storedSubmissionSchema } from "@/lib/validation/submission";

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

  it("has 6 tasks: 2 published upcoming, 1 draft, 3 published past due", () => {
    const due = (iso: string) => Date.parse(iso) > now.getTime();
    const { tasks } = data;
    expect(tasks).toHaveLength(6);
    expect(tasks.filter((t) => t.task.status === "published" && due(t.task.dueAt))).toHaveLength(2);
    expect(tasks.filter((t) => t.task.status === "draft")).toHaveLength(1);
    expect(tasks.filter((t) => t.task.status === "published" && !due(t.task.dueAt))).toHaveLength(3);
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

describe("buildSeedData — submissions and stats (T23)", () => {
  const ts = (date: Date) => ({ toDate: () => date });
  const taskById = new Map(data.tasks.map(({ id, task }) => [id, task]));

  it("stores only valid submission docs with unique ids, made before the due date and not in the future", () => {
    expect(new Set(data.submissions.map((s) => s.id)).size).toBe(data.submissions.length);
    for (const { doc } of data.submissions) {
      expect(storedSubmissionSchema.safeParse({ ...doc, createdAt: ts(doc.createdAt) }).success).toBe(true);
      const task = taskById.get(doc.taskId);
      expect(task?.status).toBe("published");
      expect(doc.type).toBe(task?.type);
      expect(doc.createdAt.getTime()).toBeLessThanOrEqual(Math.min(now.getTime(), Date.parse(task?.dueAt ?? "")));
    }
  });

  it("covers every task type, an error attempt and a coding verdict other than Accepted", () => {
    const done = data.submissions.filter((s) => s.doc.status === "done");
    expect(new Set(done.map((s) => s.doc.type))).toEqual(new Set(["coding", "resume", "intro_written"]));
    expect(data.submissions.some((s) => s.doc.status === "error")).toBe(true);
    expect(done.some((s) => s.doc.result?.judge?.verdict === "Wrong Answer")).toBe(true);
    expect(done.some((s) => s.doc.result?.judge?.verdict === "Compilation Error")).toBe(true);
  });

  it("never exceeds a task's attempt limit", () => {
    for (const [taskId, task] of taskById) {
      for (const uid of new Set(data.submissions.map((s) => s.doc.uid))) {
        const subs = data.submissions.filter((s) => s.doc.uid === uid && s.doc.taskId === taskId).map((s) => s.doc);
        expect(attemptsUsed(subs, now)).toBeLessThanOrEqual(task.maxAttempts);
      }
    }
  });

  it("has a student flagged by each needs-attention rule and students who are not flagged", () => {
    const reasons = data.studentStats.map((s) => s.doc.needsAttentionReason ?? "");
    expect(reasons.some((r) => r.startsWith("Missed"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("Average of the last"))).toBe(true);
    expect(data.studentStats.filter((s) => !s.doc.needsAttention).length).toBeGreaterThanOrEqual(2);
  });

  it("writes stats docs that parse with the dashboard schemas, one per published task", () => {
    for (const { doc } of data.studentStats) {
      const stored = { ...doc, recentScores: doc.recentScores.map((r) => ({ ...r, at: ts(r.at) })), updatedAt: ts(now) };
      expect(storedStudentStatsSchema.safeParse(stored).success).toBe(true);
    }
    for (const { doc } of data.taskStats) {
      expect(storedTaskStatsSchema.safeParse({ ...doc, updatedAt: ts(now) }).success).toBe(true);
    }
    const published = data.tasks.filter((t) => t.task.status === "published").map((t) => t.id);
    expect(data.taskStats.map((t) => t.id).sort()).toEqual(published.sort());
  });

  it("keeps the leaderboard off but has some students opted in", () => {
    expect(data.config).toEqual({ leaderboardEnabled: false });
    const optedIn = data.users.filter((u) => u.doc.showOnLeaderboard);
    expect(optedIn.length).toBeGreaterThanOrEqual(2);
    expect(optedIn.every((u) => u.doc.role === "student")).toBe(true);
  });
});
