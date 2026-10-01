import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { submissionDocToView, type SubmissionView } from "@/lib/submissions/submissionDoc";
import { publishedTasksQuery } from "@/lib/tasks/studentQueries";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedStudentStatsSchema, type StoredStudentStats } from "@/lib/validation/stats";
import type { TaskDto } from "@/lib/validation/task";
import { storedUserSchema, type StoredUser } from "@/lib/validation/user";

export const PROFILE_PAGE_SIZE = 50;

/** One page of a student's submissions, newest first (mentor/viewer). Needs the uid + createdAt index. */
export function studentSubmissionsPageQuery(db: Firestore, uid: string, after?: QueryDocumentSnapshot) {
  const base = [where("uid", "==", uid), orderBy("createdAt", "desc")] as const;
  return after
    ? query(collection(db, "submissions"), ...base, startAfter(after), limit(PROFILE_PAGE_SIZE))
    : query(collection(db, "submissions"), ...base, limit(PROFILE_PAGE_SIZE));
}

export type SubmissionPage = {
  submissions: SubmissionView[];
  /** Pass to `loadMoreSubmissions`; undefined when there is nothing older. */
  cursor?: QueryDocumentSnapshot;
};

export async function loadSubmissionPage(
  db: Firestore,
  uid: string,
  after?: QueryDocumentSnapshot,
): Promise<SubmissionPage> {
  const snapshot = await getDocs(studentSubmissionsPageQuery(db, uid, after));
  const submissions = snapshot.docs.flatMap((d) => submissionDocToView(d.id, d.data()) ?? []);
  const last = snapshot.docs[snapshot.docs.length - 1];
  return snapshot.docs.length === PROFILE_PAGE_SIZE && last ? { submissions, cursor: last } : { submissions };
}

export type StudentProfileData = {
  uid: string;
  user: StoredUser;
  stats?: StoredStudentStats;
  tasks: TaskDto[];
  firstPage: SubmissionPage;
};

/**
 * Everything `/mentor/students/[uid]` shows (SPEC.md §8.6). Undefined when there is no such student
 * (unknown uid, or a mentor/viewer account), so the page can say "not found".
 */
export async function loadStudentProfile(db: Firestore, uid: string): Promise<StudentProfileData | undefined> {
  const userSnapshot = await getDoc(doc(db, "users", uid));
  const parsedUser = userSnapshot.exists() ? storedUserSchema.safeParse(userSnapshot.data()) : undefined;
  if (!parsedUser?.success || parsedUser.data.role !== "student") return undefined;

  const [statsSnapshot, taskSnapshot, firstPage] = await Promise.all([
    getDoc(doc(db, "studentStats", uid)),
    getDocs(publishedTasksQuery(db)),
    loadSubmissionPage(db, uid),
  ]);
  const parsedStats = statsSnapshot.exists() ? storedStudentStatsSchema.safeParse(statsSnapshot.data()) : undefined;
  return {
    uid,
    user: parsedUser.data,
    ...(parsedStats?.success ? { stats: parsedStats.data } : {}),
    tasks: taskSnapshot.docs.flatMap((d) => taskDocToDto(d.id, d.data()) ?? []),
    firstPage,
  };
}
