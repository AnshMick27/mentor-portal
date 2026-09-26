/** Every API error has the same JSON shape: `{ error: "<message for the user>" }`. */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export const WRONG_DOMAIN_MESSAGE = "Please sign in with your college email.";
