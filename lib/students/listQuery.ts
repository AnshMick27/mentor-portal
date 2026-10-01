import { collection, getDocs, limit, query, where, type Firestore } from "firebase/firestore";
import { toStudentRow, type StudentRow } from "@/lib/students/list";

/** Far above a batch of ~50 plus stray sign-ups, so nobody is silently cut off. */
const STUDENT_LIST_LIMIT = 1000;

/** Every student account, including not-yet-onboarded and removed ones (mentor/viewer only, by the rules). */
export function allStudentsQuery(db: Firestore) {
  return query(collection(db, "users"), where("role", "==", "student"), limit(STUDENT_LIST_LIMIT));
}

export async function loadStudentList(db: Firestore): Promise<StudentRow[]> {
  const snapshot = await getDocs(allStudentsQuery(db));
  return snapshot.docs.flatMap((d) => toStudentRow(d.id, d.data()) ?? []);
}
