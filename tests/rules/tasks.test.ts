import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, TASK, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

describe("tasks collection", () => {
  it("student can read a published task", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.alice), "tasks", TASK.published)));
  });

  it("student cannot read a draft task", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "tasks", TASK.draft)));
  });

  it("student can query tasks filtered to status == published", async () => {
    const db = dbAs(env(), UID.alice);
    await assertSucceeds(getDocs(query(collection(db, "tasks"), where("status", "==", "published"))));
  });

  it("student cannot list all tasks without the published filter", async () => {
    await assertFails(getDocs(collection(dbAs(env(), UID.alice), "tasks")));
  });

  it("mentor can read draft tasks and list all tasks", async () => {
    const db = dbAs(env(), UID.mentor);
    await assertSucceeds(getDoc(doc(db, "tasks", TASK.draft)));
    await assertSucceeds(getDocs(collection(db, "tasks")));
  });

  it("viewer can read draft tasks and list all tasks", async () => {
    const db = dbAs(env(), UID.viewer);
    await assertSucceeds(getDoc(doc(db, "tasks", TASK.draft)));
    await assertSucceeds(getDocs(collection(db, "tasks")));
  });
});
