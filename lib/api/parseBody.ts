import type { z } from "zod";
import { jsonError } from "./errors";

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Reads a JSON body and validates it; bad JSON or invalid data → 400 with the first issue's message. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<BodyResult<z.output<S>>> {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request.") };
}
