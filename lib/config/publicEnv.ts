import { z } from "zod";

/**
 * Public (browser-safe) env. Lives apart from env.ts because that file is server-only.
 * Never add a secret here: every NEXT_PUBLIC_ value is shipped to the browser.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().trim().min(1),
  NEXT_PUBLIC_USE_EMULATOR: z.string().trim().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export function parsePublicEnv(source: EnvSource): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(
    `Missing or invalid public environment variables: ${keys.join(", ")}. Set them in .env.local (see .env.example).`,
  );
}

let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  // Each variable must be referenced literally so Next.js can inline it into the browser bundle.
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_USE_EMULATOR: process.env.NEXT_PUBLIC_USE_EMULATOR,
  });
  return cached;
}
