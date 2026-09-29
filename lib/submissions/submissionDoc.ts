import { storedSubmissionSchema, type StoredSubmission } from "@/lib/validation/submission";

/** A submission as the UI uses it: the stored doc with its id and a real `Date`. */
export type SubmissionView = Omit<StoredSubmission, "createdAt"> & { id: string; createdAt: Date };

/** Parses a `submissions/{id}` doc from either SDK; malformed docs are skipped (undefined). */
export function submissionDocToView(id: string, data: unknown): SubmissionView | undefined {
  const parsed = storedSubmissionSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return { ...parsed.data, id, createdAt: parsed.data.createdAt.toDate() };
}

/** Newest first; ties broken by attempt number, so a retry after an error sorts above it. */
export function newestFirst(submissions: readonly SubmissionView[]): SubmissionView[] {
  return [...submissions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.attempt - a.attempt);
}
