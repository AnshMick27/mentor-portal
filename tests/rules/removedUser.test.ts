import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, setupSeededRulesEnv, SUBMISSION, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

/** Alice was removed by a mentor (T34a): her user doc says `removed: true`. */
async function removeAlice() {
  await env().withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "users", UID.alice), { removed: true });
  });
}

describe("a student removed by a mentor", () => {
  it("can no longer read their own user doc, stats or submissions", async () => {
    await removeAlice();
    const db = dbAs(env(), UID.alice);
    await assertFails(getDoc(doc(db, "users", UID.alice)));
    await assertFails(getDoc(doc(db, "studentStats", UID.alice)));
    await assertFails(getDoc(doc(db, "submissions", SUBMISSION.alice)));
    await assertFails(getDocs(query(collection(db, "submissions"), where("uid", "==", UID.alice), limit(5))));
  });

  it("can no longer read published tasks", async () => {
    await removeAlice();
    const db = dbAs(env(), UID.alice);
    await assertFails(getDoc(doc(db, "tasks", TASK.published)));
    await assertFails(getDocs(query(collection(db, "tasks"), where("status", "==", "published"))));
  });

  it("still cannot write anything", async () => {
    await removeAlice();
    await assertFails(updateDoc(doc(dbAs(env(), UID.alice), "users", UID.alice), { removed: false }));
  });

  it("is still visible to mentors and viewers (their record is kept)", async () => {
    await removeAlice();
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.mentor), "users", UID.alice)));
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.viewer), "submissions", SUBMISSION.alice)));
  });

  it("does not affect other students, and `removed: false` means active", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "users", UID.bob), { removed: false });
    });
    await removeAlice();
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.bob), "users", UID.bob)));
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.bob), "tasks", TASK.published)));
  });
});
