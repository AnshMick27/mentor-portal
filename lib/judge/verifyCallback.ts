import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/config/env";
import { judgeCallbackSchema, type JudgeCallback } from "./callbackPayload";

/** Header set by the judge's `report` job: `sha256=<lowercase hex HMAC-SHA256 of the raw body>`. */
export const SIGNATURE_HEADER = "x-judge-signature";

/** Real callbacks are well under 8 KB (compile output is capped at 4,000 chars). */
export const MAX_CALLBACK_BYTES = 64 * 1024;

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

export type CallbackVerification =
  | { ok: true; payload: JudgeCallback }
  | { ok: false; reason: "config" | "too_large" | "signature" | "payload" };

/** HMAC-SHA256 of `body` as lowercase hex (what the judge sends after `sha256=`). */
export function signJudgeBody(body: Uint8Array, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Verifies a judge callback: the signature over the RAW body bytes first (timing-safe), and only then parses
 * the JSON and validates it against the callback contract. Pass the body exactly as received
 * (`await request.arrayBuffer()`), never re-serialised JSON.
 */
export function verifyJudgeCallback(
  rawBody: ArrayBuffer | Uint8Array,
  signatureHeader: string | null,
  secret: string | undefined = getServerEnv().JUDGE_WEBHOOK_SECRET,
): CallbackVerification {
  if (!secret) return { ok: false, reason: "config" };
  const body = rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody);
  if (body.byteLength > MAX_CALLBACK_BYTES) return { ok: false, reason: "too_large" };

  const match = SIGNATURE_PATTERN.exec(signatureHeader?.trim() ?? "");
  if (!match?.[1]) return { ok: false, reason: "signature" };
  const received = Buffer.from(match[1].toLowerCase(), "hex");
  const expected = Buffer.from(signJudgeBody(body, secret), "hex");
  // Both are 32 bytes after the pattern check; the length test keeps timingSafeEqual from throwing regardless.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "signature" };
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return { ok: false, reason: "payload" };
  }
  const parsed = judgeCallbackSchema.safeParse(json);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, reason: "payload" };
}
