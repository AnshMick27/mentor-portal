import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createRulesTestEnv } from "./testEnv";

/** Uids used across the rules tests. `stranger` is signed in but has no users doc (unprovisioned). */
export const UID = {
  alice: "alice",
  bob: "bob",
  mentor: "mentor1",
  viewer: "viewer1",
  stranger: "stranger",
} as const;

export const TASK = { published: "task-published", draft: "task-draft" } as const;
export const SUBMISSION = { alice: "sub-alice", bob: "sub-bob" } as const;

const now = Timestamp.fromDate(new Date("2026-09-26T10:00:00+05:30"));

function user(name: string, role: "student" | "mentor" | "viewer") {
  return {
    name,
    email: `${name.toLowerCase()}@college.test`,
    role,
    onboarded: true,
    showOnLeaderboard: false,
    createdAt: now,
  };
}

function task(title: string, status: "draft" | "published") {
  return {
    title,
    type: "resume",
    description: "Upload your resume text.",
    dueAt: now,
    status,
    maxAttempts: 3,
    createdBy: UID.mentor,
    createdAt: now,
    updatedAt: now,
  };
}

function submission(uid: string) {
  return {
    taskId: TASK.published,
    uid,
    type: "resume",
    attempt: 1,
    createdAt: now,
    status: "queued",
    content: "My resume",
  };
}

function studentStats(name: string) {
  return {
    name,
    rollNo: "0827CS000001",
    branch: "CSE",
    tasksDue: 1,
    tasksSubmitted: 0,
    missedCount: 0,
    avgBySkill: {},
    recentScores: [],
    latestNextSteps: [],
    needsAttention: false,
    updatedAt: now,
  };
}

/** Writes one document of every collection, bypassing the rules. */
export async function seedAll(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "users", UID.alice), user("Alice", "student")),
      setDoc(doc(db, "users", UID.bob), user("Bob", "student")),
      setDoc(doc(db, "users", UID.mentor), user("Mentor", "mentor")),
      setDoc(doc(db, "users", UID.viewer), user("Viewer", "viewer")),
      setDoc(doc(db, "tasks", TASK.published), task("Published task", "published")),
      setDoc(doc(db, "tasks", TASK.draft), task("Draft task", "draft")),
      setDoc(doc(db, "submissions", SUBMISSION.alice), submission(UID.alice)),
      setDoc(doc(db, "submissions", SUBMISSION.bob), submission(UID.bob)),
      setDoc(doc(db, "studentStats", UID.alice), studentStats("Alice")),
      setDoc(doc(db, "studentStats", UID.bob), studentStats("Bob")),
      setDoc(doc(db, "taskStats", TASK.published), {
        submittedCount: 1,
        notSubmittedUids: [UID.bob],
        avgScore: 7,
        updatedAt: now,
      }),
      setDoc(doc(db, "config", "app"), { leaderboardEnabled: false }),
      setDoc(doc(db, "other", "x"), { any: true }),
    ]);
  });
}

/** A client Firestore signed in as `uid` (with a verified email, like a real Google sign-in). */
export function dbAs(testEnv: RulesTestEnvironment, uid: string) {
  return testEnv
    .authenticatedContext(uid, { email: `${uid}@college.test`, email_verified: true })
    .firestore();
}

/**
 * Registers the per-file hooks: start the env once, clear and reseed before each test, clean up at the end.
 * Returns a getter because the env only exists after `beforeAll` runs.
 */
export function setupSeededRulesEnv(): () => RulesTestEnvironment {
  let testEnv: RulesTestEnvironment | undefined;
  beforeAll(async () => {
    testEnv = await createRulesTestEnv();
  });
  beforeEach(async () => {
    const env = getEnv();
    await env.clearFirestore();
    await seedAll(env);
  });
  afterAll(async () => {
    await testEnv?.cleanup();
  });
  function getEnv(): RulesTestEnvironment {
    if (!testEnv) throw new Error("Rules test env not started");
    return testEnv;
  }
  return getEnv;
}
