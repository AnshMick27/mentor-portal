/** Parses a comma-separated email list (e.g. MENTOR_EMAILS) into a set of trimmed, lowercase emails. */
export function parseEmailList(value: string | undefined): ReadonlySet<string> {
  const emails = (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return new Set(emails);
}
