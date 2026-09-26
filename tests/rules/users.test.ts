import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { describe, it } from "vitest";
import { dbAs, UID, setupSeededRulesEnv } from "./fixtures";

const env = setupSeededRulesEnv();

describe("users collection", () => {
  it("denies an unauthenticated read of users/x", async () => {
    const db = env().unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", "x")));
  });

  it("denies an unauthenticated write to users/x", async () => {
    const db = env().unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "users", "x"), { role: "mentor" }));
  });

  it("student can read their own user doc", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env(), UID.alice), "users", UID.alice)));
  });

  it("student cannot read another student's user doc", async () => {
    await assertFails(getDoc(doc(dbAs(env(), UID.alice), "users", UID.bob)));
  });

  it("student cannot list the users collection", async () => {
    await assertFails(getDocs(collection(dbAs(env(), UID.alice), "users")));
  });

  it("mentor can read any user doc and list all users", async () => {
    const db = dbAs(env(), UID.mentor);
    await assertSucceeds(getDoc(doc(db, "users", UID.bob)));
    await assertSucceeds(getDocs(collection(db, "users")));
  });

  it("viewer can read any user doc and list all users", async () => {
    const db = dbAs(env(), UID.viewer);
    await assertSucceeds(getDoc(doc(db, "users", UID.alice)));
    await assertSucceeds(getDocs(collection(db, "users")));
  });
});
