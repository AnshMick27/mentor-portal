import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import {
  latestResultsQuery,
  loadStudentDashboard,
  ownSubmissionsForTasksQuery,
} from "@/lib/dashboard/studentQueries";
import { dbAs, setupSeededRulesEnv, SUBMISSION, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

function studentDb(uid: string): Firestore {
  return dbAs(env(), uid) as unknown as Firestore;
}

/** The seeded task is due 2026-09-26 10:00 IST; one day earlier it is "this week". */
const now = new Date("2026-09-25T10:00:00+05:30");

/** Four finished results for Alice (one on another task) plus one for Bob, newest last. */
async function seedResults() {
  await env().withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const base = (await getDoc(doc(db, "submissions", SUBMISSION.alice))).data();
    const done = (uid: string, day: number, score: number, taskId: string = TASK.published) => ({
      ...base,
      uid,
      taskId,
      status: "done",
      createdAt: Timestamp.fromDate(new Date(`2026-09-2${day}T10:00:00+05:30`)),
      result: { score, summary: "s", strengths: [], improvements: [], nextSteps: [] },
    });
    await Promise.all([
      setDoc(doc(db, "submissions", "a1"), done(UID.alice, 1, 5)),
      setDoc(doc(db, "submissions", "a2"), done(UID.alice, 2, 6)),
      setDoc(doc(db, "submissions", "a3"), done(UID.alice, 3, 7, "other-task")),
      setDoc(doc(db, "submissions", "a4"), done(UID.alice, 4, 8)),
      setDoc(doc(db, "submissions", "b1"), done(UID.bob, 5, 9)),
    ]);
  });
}

describe("student dashboard queries (the exact queries /student runs)", () => {
  it("latest results: own finished results only, newest 3", async () => {
    await seedResults();
    const snapshot = await assertSucceeds(getDocs(latestResultsQuery(studentDb(UID.alice), UID.alice)));
    expect(snapshot.docs.map((d) => d.id)).toEqual(["a4", "a3", "a2"]);
  });

  it("latest results: denied for another student's uid and for an unprovisioned user", async () => {
    await assertFails(getDocs(latestResultsQuery(studentDb(UID.alice), UID.bob)));
    await assertFails(getDocs(latestResultsQuery(studentDb(UID.stranger), UID.stranger)));
  });

  it("attempts on this week's tasks: allowed for own uid, denied for someone else's", async () => {
    await seedResults();
    const own = await assertSucceeds(
      getDocs(ownSubmissionsForTasksQuery(studentDb(UID.alice), UID.alice, [TASK.published, "other-task"])),
    );
    expect(own.docs.map((d) => d.id).sort()).toEqual(["a1", "a2", "a3", "a4", SUBMISSION.alice]);
    await assertFails(getDocs(ownSubmissionsForTasksQuery(studentDb(UID.alice), UID.bob, [TASK.published])));
  });

  it("loadStudentDashboard: published tasks, this week's progress, latest results and own stats", async () => {
    await seedResults();
    const data = await loadStudentDashboard(studentDb(UID.alice), UID.alice, now);
    expect(data.tasks.map((t) => t.id)).toEqual([TASK.published]);
    expect(data.week.map((t) => [t.id, t.bestScore])).toEqual([[TASK.published, 8]]);
    expect(data.latest.map((s) => s.id)).toEqual(["a4", "a3", "a2"]);
    expect(data.stats?.name).toBe("Alice");
  });

  it("loadStudentDashboard works for a student with no stats doc and nothing due", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "studentStats", UID.bob));
    });
    const data = await loadStudentDashboard(studentDb(UID.bob), UID.bob, new Date("2026-10-20T00:00:00Z"));
    expect(data).toMatchObject({ week: [], latest: [] });
    expect(data.stats).toBeUndefined();
  });
});
