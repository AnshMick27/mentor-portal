import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/config/env";
import { AUTH_EMULATOR_PORT, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, shouldUseEmulator } from "./emulator";
import { normalizePrivateKey } from "./privateKey";

const ADMIN_APP_NAME = "mentor-portal-admin";

/** Admin SDK app (singleton). Server-only: it holds the service-account credentials. */
export function getAdminApp(): App {
  if (getApps().some((app) => app.name === ADMIN_APP_NAME)) return getApp(ADMIN_APP_NAME);

  const env = getServerEnv();
  if (shouldUseEmulator(process.env.NEXT_PUBLIC_USE_EMULATOR, process.env.NODE_ENV)) {
    // The Admin SDK reads these variables to route calls to the local emulators; no credentials needed.
    process.env.FIRESTORE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
    return initializeApp({ projectId: env.FIREBASE_ADMIN_PROJECT_ID }, ADMIN_APP_NAME);
  }

  return initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(env.FIREBASE_ADMIN_PRIVATE_KEY),
      }),
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    },
    ADMIN_APP_NAME,
  );
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
