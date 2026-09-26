import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, SUBMISSION, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

describe("submissions collection", () => {
  it("student can read their own submission", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.alice), "submissions", SUBMISSION.alice)));
  });

  it("student cannot read another student's submission", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "submissions", SUBMISSION.bob)));
  });

  it("student can query submissions filtered to their own uid", async () => {
    const db = dbAs(env(), UID.alice);
    await assertSucceeds(getDocs(query(collection(db, "submissions"), where("uid", "==", UID.alice))));
  });

  it("student cannot query another student's submissions or list all", async () => {
    const db = dbAs(env(), UID.alice);
    await assertFails(getDocs(query(collection(db, "submissions"), where("uid", "==", UID.bob))));
    await assertFails(getDocs(collection(db, "submissions")));
  });

  it("mentor can read any submission and list all", async () => {
    const db = dbAs(env(), UID.mentor);
    await assertSucceeds(getDoc(doc(db, "submissions", SUBMISSION.bob)));
    await assertSucceeds(getDocs(collection(db, "submissions")));
  });

  it("viewer can read any submission and list all", async () => {
    const db = dbAs(env(), UID.viewer);
    await assertSucceeds(getDoc(doc(db, "submissions", SUBMISSION.alice)));
    await assertSucceeds(getDocs(collection(db, "submissions")));
  });
});
