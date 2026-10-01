import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/config/env";
import { parsePublicEnv } from "@/lib/config/publicEnv";

const validServer = {
  FIREBASE_ADMIN_PROJECT_ID: "demo-project",
  FIREBASE_ADMIN_CLIENT_EMAIL: "sa@demo-project.iam.gserviceaccount.com",
  FIREBASE_ADMIN_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  ALLOWED_EMAIL_DOMAIN: "College.ac.in",
  MENTOR_EMAILS: "Ansh@college.ac.in, co@college.ac.in",
};

const validPublic = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-project.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-project",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1:web:1",
};

function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected function to throw");
}

describe("parseServerEnv", () => {
  it("accepts a minimal valid env and applies defaults", () => {
    const env = parseServerEnv(validServer);
    expect(env.ALLOWED_EMAIL_DOMAIN).toBe("college.ac.in");
    expect(env.AI_PROVIDER).toBe("anthropic");
    expect([...env.MENTOR_EMAILS]).toEqual(["ansh@college.ac.in", "co@college.ac.in"]);
    expect(env.VIEWER_EMAILS.size).toBe(0);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.AI_FALLBACK_PROVIDER).toBeUndefined();
    expect(env.APP_BASE_URL).toBeUndefined();
  });

  it("lists every missing required variable in one error", () => {
    const message = errorOf(() => parseServerEnv({}));
    expect(message).toContain("FIREBASE_ADMIN_PROJECT_ID: missing");
    expect(message).toContain("FIREBASE_ADMIN_CLIENT_EMAIL: missing");
    expect(message).toContain("FIREBASE_ADMIN_PRIVATE_KEY: missing");
    expect(message).toContain("ALLOWED_EMAIL_DOMAIN: missing");
    expect(message).toContain(".env.example");
  });

  it("treats blank values as missing", () => {
    const message = errorOf(() => parseServerEnv({ ...validServer, FIREBASE_ADMIN_PROJECT_ID: "   " }));
    expect(message).toContain("FIREBASE_ADMIN_PROJECT_ID: missing");
  });

  it("reports invalid values without echoing them", () => {
    const message = errorOf(() =>
      parseServerEnv({ ...validServer, ALLOWED_EMAIL_DOMAIN: "@college.ac.in", AI_PROVIDER: "openai-secret-value" }),
    );
    expect(message).toContain("ALLOWED_EMAIL_DOMAIN: invalid");
    expect(message).toContain("AI_PROVIDER: invalid");
    expect(message).not.toContain("openai-secret-value");
  });

  it("never includes secret values in errors", () => {
    const message = errorOf(() => parseServerEnv({ ...validServer, ALLOWED_EMAIL_DOMAIN: "" }));
    expect(message).not.toContain("BEGIN PRIVATE KEY");
  });

  it("validates optional values only when they are set", () => {
    expect(parseServerEnv({ ...validServer, APP_BASE_URL: "", GITHUB_JUDGE_REPO: "" }).APP_BASE_URL).toBeUndefined();
    expect(errorOf(() => parseServerEnv({ ...validServer, APP_BASE_URL: "not a url" }))).toContain(
      "APP_BASE_URL: invalid",
    );
    expect(errorOf(() => parseServerEnv({ ...validServer, GITHUB_JUDGE_REPO: "no-slash" }))).toContain(
      "GITHUB_JUDGE_REPO: invalid",
    );
    expect(parseServerEnv({ ...validServer, AI_PROVIDER: "gemini", GITHUB_JUDGE_REPO: "org/judge" })).toMatchObject({
      AI_PROVIDER: "gemini",
      GITHUB_JUDGE_REPO: "org/judge",
    });
    expect(parseServerEnv({ ...validServer, AI_PROVIDER: "groq", GROQ_API_KEY: "gsk-test" })).toMatchObject({
      AI_PROVIDER: "groq",
      GROQ_API_KEY: "gsk-test",
    });
    expect(
      parseServerEnv({ ...validServer, AI_FALLBACK_PROVIDER: "groq", AI_FALLBACK_MODEL: "openai/gpt-oss-20b" }),
    ).toMatchObject({ AI_FALLBACK_PROVIDER: "groq", AI_FALLBACK_MODEL: "openai/gpt-oss-20b" });
    expect(errorOf(() => parseServerEnv({ ...validServer, AI_FALLBACK_PROVIDER: "openai" }))).toContain(
      "AI_FALLBACK_PROVIDER: invalid",
    );
  });
});

describe("parsePublicEnv", () => {
  it("accepts a complete public env", () => {
    expect(parsePublicEnv(validPublic)).toEqual(validPublic);
  });

  it("lists missing public variables", () => {
    const message = errorOf(() => parsePublicEnv({ ...validPublic, NEXT_PUBLIC_FIREBASE_APP_ID: undefined }));
    expect(message).toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(message).not.toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
  });
});
