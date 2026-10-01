import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDocs, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import {
  loadStudentProfile,
  loadSubmissionPage,
  PROFILE_PAGE_SIZE,
  studentSubmissionsPageQuery,
} from "@/lib/dashboard/profileQueries";
import { dbAs, setupSeededRulesEnv, SUBMISSION, TASK, UID } from "./fixtures";

const env = setupSeededRulesEnv();

function db(uid: string): Firestore {
  return dbAs(env(), uid) as unknown as Firestore;
}

describe("student profile queries (the exact queries /mentor/students/[uid] runs)", () => {
  it("mentor and viewer load a student's profile with stats, tasks and attempts", async () => {
    for (const uid of [UID.mentor, UID.viewer]) {
      const data = await loadStudentProfile(db(uid), UID.alice);
      expect(data?.user.name).toBe("Alice");
      expect(data?.stats?.name).toBe("Alice");
      expect(data?.tasks.map((t) => t.id)).toEqual([TASK.published]);
      expect(data?.firstPage.submissions.map((s) => s.id)).toEqual([SUBMISSION.alice]);
      expect(data?.firstPage.cursor).toBeUndefined();
    }
  });

  it("is 'not found' for staff accounts and unknown uids", async () => {
    expect(await loadStudentProfile(db(UID.mentor), UID.viewer)).toBeUndefined();
    expect(await loadStudentProfile(db(UID.mentor), "nobody")).toBeUndefined();
  });

  it("a student cannot run the profile query for another student (or themself through this page)", async () => {
    await assertFails(getDocs(studentSubmissionsPageQuery(db(UID.alice), UID.bob)));
    await expect(loadStudentProfile(db(UID.alice), UID.bob)).rejects.toThrow();
    // Their own submissions are readable, as on the task page; the /mentor area itself is guarded in the app.
    await assertSucceeds(getDocs(studentSubmissionsPageQuery(db(UID.alice), UID.alice)));
  });

  it("an unprovisioned user is refused", async () => {
    await assertFails(getDocs(studentSubmissionsPageQuery(db(UID.stranger), UID.alice)));
  });

  it("pages through attempts newest first, 50 at a time", async () => {
    await env().withSecurityRulesDisabled(async (ctx) => {
      const store = ctx.firestore();
      const base = { taskId: TASK.published, uid: UID.alice, type: "resume", attempt: 1, status: "error", content: "x" };
      await Promise.all(
        Array.from({ length: PROFILE_PAGE_SIZE + 5 }, (_, i) =>
          setDoc(doc(store, "submissions", `p${String(i).padStart(3, "0")}`), {
            ...base,
            createdAt: Timestamp.fromMillis(Date.parse("2026-09-27T00:00:00Z") + i * 60_000),
          }),
        ),
      );
    });
    const first = await loadSubmissionPage(db(UID.mentor), UID.alice);
    expect(first.submissions).toHaveLength(PROFILE_PAGE_SIZE);
    expect(first.submissions[0]?.id).toBe("p054"); // newest
    expect(first.cursor).toBeDefined();
    const second = await loadSubmissionPage(db(UID.mentor), UID.alice, first.cursor);
    expect(second.submissions.map((s) => s.id)).toEqual(["p004", "p003", "p002", "p001", "p000", SUBMISSION.alice]);
    expect(second.cursor).toBeUndefined();
  });
});
