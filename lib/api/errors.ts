/** Every API error has the same JSON shape: `{ error: "<message for the user>" }`. */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export const WRONG_DOMAIN_MESSAGE = "Please sign in with your college email.";

/** A mentor removed this student from the portal (T34a). */
export const REMOVED_MESSAGE = "Your access to the portal has been removed. Contact your mentor if this is a mistake.";

/** A new student before a mentor approves them (T48). */
export const PENDING_MESSAGE = "Your account is waiting for your mentor's approval. You will see your tasks once you are approved.";
