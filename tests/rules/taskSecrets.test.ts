import { assertFails } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { beforeEach, describe, it } from "vitest";
import { dbAs, TASK, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

// taskSecrets/{taskId} holds a scenario task's grading notes (T50): what a strong answer covers. A student who could
// read it would see the answer, so it is server only like drafts (the catch-all rule); mentors use the API.
beforeEach(async () => {
  await env().withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "taskSecrets", TASK.published), { gradingNotes: "Mentions the root cause." });
  });
});

describe("taskSecrets collection (server only)", () => {
  for (const uid of [UID.alice, UID.bob, UID.mentor, UID.viewer, UID.stranger]) {
    it(`${uid} cannot read, list, write or delete task secrets`, async () => {
      const db = dbAs(env(), uid);
      await assertFails(getDoc(doc(db, "taskSecrets", TASK.published)));
      await assertFails(getDocs(collection(db, "taskSecrets")));
      await assertFails(setDoc(doc(db, "taskSecrets", TASK.published), { gradingNotes: "x" }));
      await assertFails(setDoc(doc(db, "taskSecrets", "new-task"), { gradingNotes: "x" }));
      await assertFails(deleteDoc(doc(db, "taskSecrets", TASK.published)));
    });
  }
});
