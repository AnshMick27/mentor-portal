import { assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { createRulesTestEnv } from "./testEnv";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await createRulesTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("users collection", () => {
  it("denies an unauthenticated read of users/x", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", "x")));
  });

  it("denies an unauthenticated write to users/x", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "users", "x"), { role: "mentor" }));
  });
});
