import "server-only";
import { z } from "zod";
import { parseEmailList } from "./emailList";

/** Treats unset and blank values the same, so `KEY=` in .env files counts as missing. */
function blankAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema);
}

const requiredString = blankAsUndefined(z.string().trim());
const optionalString = blankAsUndefined(z.string().trim().optional());

const serverEnvSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: requiredString,
  FIREBASE_ADMIN_CLIENT_EMAIL: blankAsUndefined(z.email()),
  FIREBASE_ADMIN_PRIVATE_KEY: requiredString,
  ALLOWED_EMAIL_DOMAIN: blankAsUndefined(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "must be a domain like college.ac.in (no @)"),
  ),
  MENTOR_EMAILS: optionalString.transform(parseEmailList),
  VIEWER_EMAILS: optionalString.transform(parseEmailList),
  AI_PROVIDER: blankAsUndefined(z.enum(["anthropic", "gemini"]).default("anthropic")),
  AI_MODEL: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GITHUB_JUDGE_REPO: blankAsUndefined(
    z
      .string()
      .trim()
      .regex(/^[\w.-]+\/[\w.-]+$/, "must look like org/repo")
      .optional(),
  ),
  GITHUB_JUDGE_TOKEN: optionalString,
  JUDGE_WEBHOOK_SECRET: optionalString,
  CRON_SECRET: optionalString,
  APP_BASE_URL: blankAsUndefined(z.url().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

/** Validates server env vars. Throws one error naming every missing or invalid variable (never their values). */
export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = new Map<string, string>();
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "(unknown)");
    if (problems.has(key)) continue;
    const isMissing = source[key] === undefined || source[key]?.trim() === "";
    problems.set(key, isMissing ? "missing" : `invalid (${issue.message})`);
  }
  const lines = [...problems].map(([key, problem]) => `  - ${key}: ${problem}`);
  throw new Error(
    `Invalid server environment variables:\n${lines.join("\n")}\nSet them in .env.local (see .env.example) or in the Vercel project settings.`,
  );
}

let cached: ServerEnv | undefined;

/** Server env, validated on first use and cached. Server-only: importing this file in client code fails the build. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
