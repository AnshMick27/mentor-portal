import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { judgeCallbackSchema } from "@/lib/judge/callbackPayload";
import { MAX_CALLBACK_BYTES, verifyJudgeCallback } from "@/lib/judge/verifyCallback";

const env = vi.hoisted(() => ({ JUDGE_WEBHOOK_SECRET: "env-secret" as string | undefined }));
vi.mock("@/lib/config/env", () => ({ getServerEnv: () => env }));

const SECRET = "a-long-random-test-secret";
const encoder = new TextEncoder();

/** Exactly what the judge's report job sends (compact JSON, from judge_util.py + judge.yml). */
const bodies = {
  accepted: '{"status":"done","judge":{"passed":3,"total":3,"verdict":"Accepted"},"submissionId":"abc123"}',
  wrong: '{"status":"done","judge":{"passed":1,"total":3,"verdict":"Wrong Answer","firstFailedTest":2},"submissionId":"abc123"}',
  compile:
    '{"status":"done","judge":{"passed":0,"total":3,"verdict":"Compilation Error"},"compileOutput":"Main.cpp:1:1: error: x","submissionId":"abc123"}',
  error: '{"status":"error","error":"The judge had an internal error.","submissionId":"abc123"}',
};

/** The header as the judge's report job builds it (Python hmac → lowercase hex). */
function sign(body: string | Uint8Array, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

const verify = (body: string, header: string | null, secret: string | undefined = SECRET) =>
  verifyJudgeCallback(encoder.encode(body), header, secret);

beforeEach(() => {
  env.JUDGE_WEBHOOK_SECRET = "env-secret";
});

describe("verifyJudgeCallback: signature", () => {
  it("accepts every callback shape the judge sends, with a valid signature", () => {
    for (const body of Object.values(bodies)) {
      const result = verify(body, sign(body));
      expect(result).toEqual({ ok: true, payload: JSON.parse(body) });
    }
  });

  it("accepts an ArrayBuffer body (request.arrayBuffer()) and an upper-case hex signature", () => {
    const bytes = encoder.encode(bodies.wrong);
    const header = `sha256=${sign(bodies.wrong).slice(7).toUpperCase()}`;
    expect(verifyJudgeCallback(bytes.buffer, header, SECRET).ok).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verify(bodies.accepted, sign(bodies.accepted, "other-secret"))).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a tampered body (signature for the original)", () => {
    const tampered = bodies.wrong.replace('"passed":1', '"passed":3').replace("Wrong Answer", "Accepted");
    expect(verify(tampered, sign(bodies.wrong))).toEqual({ ok: false, reason: "signature" });
    // Even a whitespace-only change breaks it: the signature covers the raw bytes, not the parsed JSON.
    expect(verify(`${bodies.wrong} `, sign(bodies.wrong))).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a missing or garbled header", () => {
    const good = sign(bodies.accepted);
    for (const header of [null, "", "sha256=", good.slice(7), `sha1=${good.slice(7)}`, `sha256=${"z".repeat(64)}`, `${good} extra`]) {
      expect(verify(bodies.accepted, header)).toEqual({ ok: false, reason: "signature" });
    }
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const hex = sign(bodies.accepted).slice(7);
    for (const header of [`sha256=${hex.slice(0, 62)}`, `sha256=${hex}00`, `sha256=${hex.slice(0, 32)}`]) {
      expect(verify(bodies.accepted, header)).toEqual({ ok: false, reason: "signature" });
    }
  });

  it("refuses to verify without a secret, and uses JUDGE_WEBHOOK_SECRET from env by default", () => {
    expect(verify(bodies.accepted, sign(bodies.accepted), "")).toEqual({ ok: false, reason: "config" });
    const bytes = encoder.encode(bodies.accepted);
    expect(verifyJudgeCallback(bytes, sign(bodies.accepted, "env-secret")).ok).toBe(true);
    env.JUDGE_WEBHOOK_SECRET = undefined;
    expect(verifyJudgeCallback(bytes, sign(bodies.accepted, "env-secret"))).toEqual({ ok: false, reason: "config" });
  });

  it("refuses bodies over 64 KB before hashing", () => {
    const big = `{"pad":"${"x".repeat(MAX_CALLBACK_BYTES)}"}`;
    expect(verify(big, sign(big))).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("verifyJudgeCallback: payload (signature valid)", () => {
  const signedPayload = (body: string) => verify(body, sign(body));

  it("rejects non-JSON and invalid UTF-8", () => {
    expect(signedPayload("not json")).toEqual({ ok: false, reason: "payload" });
    const bad = new Uint8Array([0x7b, 0xff, 0x7d]);
    expect(verifyJudgeCallback(bad, sign(bad), SECRET)).toEqual({ ok: false, reason: "payload" });
  });

  it("rejects bodies that break the contract", () => {
    const wrong = JSON.parse(bodies.wrong) as Record<string, unknown>;
    const cases = [
      { ...wrong, submissionId: "../../etc" },
      { ...wrong, status: "running" },
      { ...wrong, extra: true },
      { ...wrong, judge: { passed: 1, total: 3, verdict: "Wrong Answer on test 2", firstFailedTest: 2 } },
    ];
    for (const body of cases) expect(signedPayload(JSON.stringify(body))).toEqual({ ok: false, reason: "payload" });
  });
});

describe("judgeCallbackSchema rules", () => {
  const done = (judge: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    judgeCallbackSchema.safeParse({ submissionId: "s1", status: "done", judge, ...extra }).success;

  it("Accepted passes every test and names no failing test", () => {
    expect(done({ passed: 3, total: 3, verdict: "Accepted" })).toBe(true);
    expect(done({ passed: 2, total: 3, verdict: "Accepted" })).toBe(false);
    expect(done({ passed: 3, total: 3, verdict: "Accepted", firstFailedTest: 3 })).toBe(false);
  });

  it("failing verdicts need firstFailedTest = passed + 1", () => {
    for (const verdict of ["Wrong Answer", "Time Limit Exceeded", "Runtime Error"]) {
      expect(done({ passed: 0, total: 3, verdict, firstFailedTest: 1 })).toBe(true);
      expect(done({ passed: 2, total: 3, verdict, firstFailedTest: 3 })).toBe(true);
      expect(done({ passed: 1, total: 3, verdict })).toBe(false);
      expect(done({ passed: 1, total: 3, verdict, firstFailedTest: 3 })).toBe(false);
      expect(done({ passed: 3, total: 3, verdict, firstFailedTest: 4 })).toBe(false);
    }
  });

  it("Compilation Error passes nothing; compileOutput only with it and at most 4,000 chars", () => {
    expect(done({ passed: 0, total: 3, verdict: "Compilation Error" })).toBe(true);
    expect(done({ passed: 0, total: 3, verdict: "Compilation Error" }, { compileOutput: "x".repeat(4000) })).toBe(true);
    expect(done({ passed: 0, total: 3, verdict: "Compilation Error" }, { compileOutput: "x".repeat(4001) })).toBe(false);
    expect(done({ passed: 1, total: 3, verdict: "Compilation Error" })).toBe(false);
    expect(done({ passed: 3, total: 3, verdict: "Accepted" }, { compileOutput: "warning" })).toBe(false);
  });

  it("rejects impossible counts", () => {
    expect(done({ passed: 4, total: 3, verdict: "Accepted" })).toBe(false);
    expect(done({ passed: 0, total: 0, verdict: "Compilation Error" })).toBe(false);
    expect(done({ passed: 1.5, total: 3, verdict: "Wrong Answer", firstFailedTest: 2 })).toBe(false);
  });

  it("an error callback carries a short message and nothing else", () => {
    const error = (body: Record<string, unknown>) =>
      judgeCallbackSchema.safeParse({ submissionId: "s1", status: "error", ...body }).success;
    expect(error({ error: "Invalid problem slug." })).toBe(true);
    expect(error({ error: "" })).toBe(false);
    expect(error({ error: "x".repeat(501) })).toBe(false);
    expect(error({ error: "x", judge: { passed: 0, total: 1, verdict: "Accepted" } })).toBe(false);
  });
});
