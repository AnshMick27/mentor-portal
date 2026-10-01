import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { allStudentStatsQuery, loadMentorDashboard, recentPublishedTasksQuery } from "@/lib/dashboard/mentorQueries";
import { dbAs, setupSeededRulesEnv, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

function db(uid: string): Firestore {
  return dbAs(env(), uid) as unknown as Firestore;
}

describe("mentor dashboard queries (the exact queries /mentor runs)", () => {
  it("mentor and viewer load tasks, task stats and every student's stats", async () => {
    for (const uid of [UID.mentor, UID.viewer]) {
      const data = await loadMentorDashboard(db(uid));
      expect(data.tasks.map((t) => t.id)).toEqual([TASK.published]); // drafts never appear
      expect([...data.taskStats.keys()]).toEqual([TASK.published]);
      expect(data.taskStats.get(TASK.published)?.notSubmittedUids).toEqual([UID.bob]);
      expect(data.students.map((s) => s.uid).sort()).toEqual([UID.alice, UID.bob]);
    }
  });

  it("a student cannot list every student's stats or read task stats", async () => {
    await assertFails(getDocs(allStudentStatsQuery(db(UID.alice))));
    await assertFails(getDoc(doc(db(UID.alice), "taskStats", TASK.published)));
    await expect(loadMentorDashboard(db(UID.alice))).rejects.toThrow();
  });

  it("an unprovisioned user can run none of the dashboard queries", async () => {
    await assertFails(getDocs(allStudentStatsQuery(db(UID.stranger))));
    await assertFails(getDocs(recentPublishedTasksQuery(db(UID.stranger))));
  });

  it("the recent-tasks query itself is allowed for staff", async () => {
    await assertSucceeds(getDocs(recentPublishedTasksQuery(db(UID.viewer))));
  });
});
