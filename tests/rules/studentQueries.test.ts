import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { SubmissionView } from "@/lib/submissions/submissionDoc";
import {
  loadStudentBoard,
  loadStudentTask,
  ownSubmissionsQuery,
  ownTaskSubmissionsQuery,
  publishedTasksQuery,
  watchOwnTaskSubmissions,
} from "@/lib/tasks/studentQueries";
import { dbAs, setupSeededRulesEnv, SUBMISSION, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

/** The rules-testing context returns a compat-typed Firestore; the modular API accepts it at runtime. */
function studentDb(uid: string): Firestore {
  return dbAs(env(), uid) as unknown as Firestore;
}

describe("student board queries (the exact queries the app runs)", () => {
  it("the published-tasks query is allowed for a student and returns no drafts", async () => {
    const snapshot = await assertSucceeds(getDocs(publishedTasksQuery(studentDb(UID.alice))));
    expect(snapshot.docs.map((d) => d.id)).toEqual([TASK.published]);
  });

  it("the own-submissions query is allowed and returns only the student's own", async () => {
    const snapshot = await assertSucceeds(getDocs(ownSubmissionsQuery(studentDb(UID.alice), UID.alice)));
    expect(snapshot.docs.map((d) => d.id)).toEqual([SUBMISSION.alice]);
  });

  it("loadStudentBoard returns published tasks only, plus the student's own submissions", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const draft = await getDoc(doc(db, "tasks", TASK.draft));
      await setDoc(doc(db, "tasks", "another-draft"), { ...draft.data(), title: "Another draft" });
    });
    const { tasks, submissions } = await loadStudentBoard(studentDb(UID.alice), UID.alice);
    expect(tasks.map((t) => t.id)).toEqual([TASK.published]);
    expect(tasks.every((t) => t.status === "published")).toBe(true);
    expect(submissions.map((s) => [s.id, s.taskId, s.uid])).toEqual([[SUBMISSION.alice, TASK.published, UID.alice]]);
    expect(submissions[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("loadStudentTask returns a published task", async () => {
    expect((await loadStudentTask(studentDb(UID.bob), TASK.published))?.id).toBe(TASK.published);
  });

  it("loadStudentTask treats a draft like a missing task", async () => {
    expect(await loadStudentTask(studentDb(UID.alice), TASK.draft)).toBeUndefined();
    expect(await loadStudentTask(studentDb(UID.alice), "does-not-exist")).toBeUndefined();
  });
});

describe("task attempt history query (the exact query the task page listens to)", () => {
  /** Two more attempts by Alice (one on this task, one elsewhere) so ordering and filtering show. */
  async function seedMoreAttempts() {
    await env().withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const base = (await getDoc(doc(db, "submissions", SUBMISSION.alice))).data();
      await setDoc(doc(db, "submissions", "alice-newer"), {
        ...base,
        attempt: 2,
        status: "done",
        createdAt: Timestamp.fromDate(new Date("2026-09-27T10:00:00+05:30")),
        result: { score: 7.5, summary: "Good", strengths: [], improvements: [], nextSteps: [] },
      });
      await setDoc(doc(db, "submissions", "alice-other-task"), { ...base, taskId: "other-task" });
    });
  }

  it("is allowed for the student and returns only their attempts on that task, newest first", async () => {
    await seedMoreAttempts();
    const snapshot = await assertSucceeds(
      getDocs(ownTaskSubmissionsQuery(studentDb(UID.alice), UID.alice, TASK.published)),
    );
    expect(snapshot.docs.map((d) => d.id)).toEqual(["alice-newer", SUBMISSION.alice]);
  });

  it("is denied when a student asks for another student's attempts", async () => {
    await assertFails(getDocs(ownTaskSubmissionsQuery(studentDb(UID.alice), UID.bob, TASK.published)));
  });

  it("is denied for an unprovisioned user", async () => {
    await assertFails(getDocs(ownTaskSubmissionsQuery(studentDb(UID.stranger), UID.stranger, TASK.published)));
  });

  it("watchOwnTaskSubmissions delivers the parsed attempts through a listener", async () => {
    await seedMoreAttempts();
    const received = await new Promise<SubmissionView[]>((resolve, reject) => {
      const stop = watchOwnTaskSubmissions(
        studentDb(UID.alice),
        UID.alice,
        TASK.published,
        (list) => {
          stop();
          resolve(list);
        },
        reject,
      );
    });
    expect(received.map((s) => [s.id, s.attempt, s.result?.score])).toEqual([
      ["alice-newer", 2, 7.5],
      [SUBMISSION.alice, 1, undefined],
    ]);
  });
});
