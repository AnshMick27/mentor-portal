import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDocs, updateDoc, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { allStudentsQuery, loadStudentList } from "@/lib/students/listQuery";
import { dbAs, setupSeededRulesEnv, UID } from "./fixtures";

const env = setupSeededRulesEnv();

function db(uid: string): Firestore {
  return dbAs(env(), uid) as unknown as Firestore;
}

describe("student list query (the exact query /mentor/students runs)", () => {
  it("mentor and viewer list every student account, including removed ones, and no staff", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "users", UID.bob), { removed: true });
    });
    for (const uid of [UID.mentor, UID.viewer]) {
      const rows = await loadStudentList(db(uid));
      expect(rows.map((r) => [r.uid, r.removed]).sort()).toEqual([
        [UID.alice, false],
        [UID.bob, true],
      ]);
    }
  });

  it("a student cannot list other users", async () => {
    await assertFails(getDocs(allStudentsQuery(db(UID.alice))));
  });

  it("an unprovisioned or removed user cannot list users", async () => {
    await assertFails(getDocs(allStudentsQuery(db(UID.stranger))));
    await env().withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "users", UID.viewer), { removed: true });
    });
    await assertFails(getDocs(allStudentsQuery(db(UID.viewer))));
    await assertSucceeds(getDocs(allStudentsQuery(db(UID.mentor))));
  });
});
