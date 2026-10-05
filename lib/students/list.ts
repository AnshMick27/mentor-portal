import { z } from "zod";
import { timestampLike } from "@/lib/validation/timestamp";
import { storedUserSchema, type Branch } from "@/lib/validation/user";

/** One student account as the mentor's student list shows it. */
export type StudentRow = {
  uid: string;
  name: string;
  email: string;
  rollNo?: string;
  branch?: Branch;
  onboarded: boolean;
  removed: boolean;
  /** Waiting for a mentor's approval (T48); absent = approved. */
  pending?: boolean;
  /** When the account was created (first sign-in); missing on very old docs. */
  joinedAt?: Date;
};

const userDocSchema = storedUserSchema.extend({ createdAt: timestampLike.optional() });

/** A `users/{uid}` doc → a row; anything that is not a valid student doc is skipped (undefined). */
export function toStudentRow(uid: string, data: unknown): StudentRow | undefined {
  const parsed = userDocSchema.safeParse(data);
  if (!parsed.success || parsed.data.role !== "student") return undefined;
  const { name, email, rollNo, branch, onboarded, removed, pendingApproval, createdAt } = parsed.data;
  return {
    uid,
    name,
    email,
    onboarded,
    removed: removed === true,
    ...(pendingApproval === true ? { pending: true } : {}),
    ...(rollNo ? { rollNo } : {}),
    ...(branch ? { branch } : {}),
    ...(createdAt ? { joinedAt: createdAt.toDate() } : {}),
  };
}

/** Case-insensitive match on name, email or roll number; blank search keeps everyone. */
export function searchStudents(rows: readonly StudentRow[], search: string): StudentRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => [row.name, row.email, row.rollNo ?? ""].some((field) => field.toLowerCase().includes(needle)));
}

/** Active and removed students, each by name. */
export function splitStudents(rows: readonly StudentRow[]): { active: StudentRow[]; removed: StudentRow[] } {
  const byName = (a: StudentRow, b: StudentRow) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email);
  return {
    active: rows.filter((row) => !row.removed).sort(byName),
    removed: rows.filter((row) => row.removed).sort(byName),
  };
}

/** `POST /api/students/[uid]/remove|restore` reply. */
export const removalResponseSchema = z.object({ student: z.object({ uid: z.string(), removed: z.boolean() }) });
