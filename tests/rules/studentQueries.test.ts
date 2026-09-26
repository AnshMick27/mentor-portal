import { assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { loadStudentBoard, loadStudentTask, ownSubmissionsQuery, publishedTasksQuery } from "@/lib/tasks/studentQueries";
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

  it("loadStudentBoard returns published tasks only, plus own attempt counts", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const draft = await getDoc(doc(db, "tasks", TASK.draft));
      await setDoc(doc(db, "tasks", "another-draft"), { ...draft.data(), title: "Another draft" });
    });
    const { tasks, attempts } = await loadStudentBoard(studentDb(UID.alice), UID.alice);
    expect(tasks.map((t) => t.id)).toEqual([TASK.published]);
    expect(tasks.every((t) => t.status === "published")).toBe(true);
    expect(Object.fromEntries(attempts)).toEqual({ [TASK.published]: 1 });
  });

  it("loadStudentTask returns a published task with the student's attempts", async () => {
    const { task, attemptsUsed } = await loadStudentTask(studentDb(UID.bob), UID.bob, TASK.published);
    expect(task?.id).toBe(TASK.published);
    expect(attemptsUsed).toBe(1);
  });

  it("loadStudentTask treats a draft like a missing task", async () => {
    expect(await loadStudentTask(studentDb(UID.alice), UID.alice, TASK.draft)).toEqual({
      task: undefined,
      attemptsUsed: 0,
    });
    expect(await loadStudentTask(studentDb(UID.alice), UID.alice, "does-not-exist")).toEqual({
      task: undefined,
      attemptsUsed: 0,
    });
  });
});
