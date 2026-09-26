import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, TASK, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

describe("studentStats, taskStats and config collections", () => {
  it("student can read their own studentStats", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.alice), "studentStats", UID.alice)));
  });

  it("student cannot read another student's studentStats", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "studentStats", UID.bob)));
  });

  it("student cannot list studentStats", async () => {
    await assertFails(getDocs(collection(dbAs(env(), UID.alice), "studentStats")));
  });

  it("student cannot read taskStats", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "taskStats", TASK.published)));
  });

  it("student cannot read config/app", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "config", "app")));
  });

  for (const staff of [UID.mentor, UID.viewer]) {
    it(`${staff} can read all studentStats, taskStats and config/app`, async () => {
      const db = dbAs(env(), staff);
      await assertSucceeds(getDocs(collection(db, "studentStats")));
      await assertSucceeds(getDoc(doc(db, "taskStats", TASK.published)));
      await assertSucceeds(getDocs(collection(db, "taskStats")));
      await assertSucceeds(getDoc(doc(db, "config", "app")));
    });
  }
});
