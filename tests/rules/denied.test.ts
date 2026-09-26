import { assertFails } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, SUBMISSION, TASK, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

/** One existing doc per collection, plus a collection the rules never mention. */
const EXISTING: [string, string][] = [
  ["users", UID.alice],
  ["tasks", TASK.published],
  ["submissions", SUBMISSION.alice],
  ["studentStats", UID.alice],
  ["taskStats", TASK.published],
  ["config", "app"],
  ["other", "x"],
];

describe("client writes are always denied", () => {
  for (const uid of [UID.alice, UID.mentor, UID.viewer, UID.stranger]) {
    for (const [col, id] of EXISTING) {
      it(`${uid} cannot create, update or delete ${col}/${id}`, async () => {
        const db = dbAs(env(), uid);
        await assertFails(setDoc(doc(db, col, `new-${id}`), { any: true }));
        await assertFails(updateDoc(doc(db, col, id), { any: true }));
        await assertFails(deleteDoc(doc(db, col, id)));
      });
    }
  }

  it("student cannot set their own role to mentor", async () => {
    const db = dbAs(env(), UID.alice);
    await assertFails(updateDoc(doc(db, "users", UID.alice), { role: "mentor" }));
    await assertFails(setDoc(doc(db, "users", UID.alice), { role: "mentor" }, { merge: true }));
  });

  it("student cannot set a score on their own submission", async () => {
    const db = dbAs(env(), UID.alice);
    await assertFails(
      updateDoc(doc(db, "submissions", SUBMISSION.alice), { "result.score": 10, status: "done" }),
    );
  });

  it("student cannot change their own studentStats", async () => {
    const db = dbAs(env(), UID.alice);
    await assertFails(updateDoc(doc(db, "studentStats", UID.alice), { needsAttention: false }));
  });
});

describe("unprovisioned and unknown access is denied", () => {
  const readable: [string, string][] = [
    ["users", UID.stranger],
    ["users", UID.alice],
    ["tasks", TASK.published],
    ["submissions", SUBMISSION.alice],
    ["studentStats", UID.stranger],
    ["taskStats", TASK.published],
    ["config", "app"],
  ];

  for (const [col, id] of readable) {
    it(`signed-in user without a users doc cannot read ${col}/${id}`, async () => {
      await assertFails(getDoc(doc(dbAs(env(), UID.stranger), col, id)));
    });
  }

  it("mentor cannot read a collection the rules do not list", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.mentor), "other", "x")));
  });
});
