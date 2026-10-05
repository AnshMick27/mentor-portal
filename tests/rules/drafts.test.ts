import { assertFails } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { beforeEach, describe, it } from "vitest";
import { dbAs, TASK, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();
const ALICE_DRAFT = `${UID.alice}_${TASK.published}`;

// drafts/{uid}_{taskId} times an answer on the server (SPEC.md §8.9). A client that could write it could fake the
// time; one that could read it learns nothing useful. So nobody reads or writes it, not even its own student.
beforeEach(async () => {
  await env().withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "drafts", ALICE_DRAFT), { uid: UID.alice, taskId: TASK.published, openedAt: Timestamp.now() });
  });
});

describe("drafts collection (server only)", () => {
  for (const uid of [UID.alice, UID.bob, UID.mentor, UID.viewer, UID.stranger]) {
    it(`${uid} cannot read, list, write or delete drafts`, async () => {
      const db = dbAs(env(), uid);
      await assertFails(getDoc(doc(db, "drafts", ALICE_DRAFT)));
      await assertFails(getDocs(collection(db, "drafts")));
      await assertFails(setDoc(doc(db, "drafts", ALICE_DRAFT), { uid: UID.alice, taskId: TASK.published, openedAt: Timestamp.fromMillis(0) }));
      await assertFails(setDoc(doc(db, "drafts", `${uid}_${TASK.published}`), { openedAt: Timestamp.fromMillis(0) }));
      await assertFails(deleteDoc(doc(db, "drafts", ALICE_DRAFT)));
    });
  }
});
