import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, setupSeededRulesEnv, SUBMISSION, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

/** Alice signed up after T48 and is waiting for a mentor: her user doc says `pendingApproval: true`. */
async function makeAlicePending(value: unknown = true) {
  await env().withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "users", UID.alice), { pendingApproval: value });
  });
}

describe("a student waiting for approval (T48)", () => {
  it("cannot read tasks, their own user doc, stats or submissions", async () => {
    await makeAlicePending();
    const db = dbAs(env(), UID.alice);
    await assertFails(getDoc(doc(db, "tasks", TASK.published)));
    await assertFails(getDocs(query(collection(db, "tasks"), where("status", "==", "published"))));
    await assertFails(getDoc(doc(db, "users", UID.alice)));
    await assertFails(getDoc(doc(db, "studentStats", UID.alice)));
    await assertFails(getDoc(doc(db, "submissions", SUBMISSION.alice)));
    await assertFails(getDocs(query(collection(db, "submissions"), where("uid", "==", UID.alice), limit(5))));
  });

  it("cannot approve themselves", async () => {
    await makeAlicePending();
    const db = dbAs(env(), UID.alice);
    await assertFails(updateDoc(doc(db, "users", UID.alice), { pendingApproval: false }));
    await assertFails(setDoc(doc(db, "users", UID.alice), { pendingApproval: false }, { merge: true }));
  });

  it("is visible to mentors and viewers, who list everyone waiting", async () => {
    await makeAlicePending();
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.mentor), "users", UID.alice)));
    const pendingQuery = (uid: string) =>
      query(collection(dbAs(env(), uid), "users"), where("role", "==", "student"), where("pendingApproval", "==", true), limit(200));
    await assertSucceeds(getDocs(pendingQuery(UID.mentor)));
    await assertSucceeds(getDocs(pendingQuery(UID.viewer)));
    await assertFails(getDocs(pendingQuery(UID.bob)));
  });

  it("does not affect approved students, and `pendingApproval: false` means approved", async () => {
    await makeAlicePending(false);
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.alice), "tasks", TASK.published)));
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.bob), "users", UID.bob)));
  });
});
