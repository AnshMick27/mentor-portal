import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { getPublicEnv } from "@/lib/config/publicEnv";
import { AUTH_EMULATOR_PORT, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, shouldUseEmulator } from "./emulator";

/** Browser Firebase app (singleton). Only public config here; the browser never writes to Firestore. */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const env = getPublicEnv();
  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

function emulatorEnabled(): boolean {
  return shouldUseEmulator(getPublicEnv().NEXT_PUBLIC_USE_EMULATOR, process.env.NODE_ENV);
}

// Stored on globalThis so dev hot-reloads do not connect the emulators twice (which throws).
const state = globalThis as typeof globalThis & {
  __mentorPortalAuth?: Auth;
  __mentorPortalDb?: Firestore;
};

export function getClientAuth(): Auth {
  if (!state.__mentorPortalAuth) {
    const auth = getAuth(getFirebaseApp());
    if (emulatorEnabled()) {
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true });
    }
    state.__mentorPortalAuth = auth;
  }
  return state.__mentorPortalAuth;
}

export function getClientDb(): Firestore {
  if (!state.__mentorPortalDb) {
    const db = getFirestore(getFirebaseApp());
    if (emulatorEnabled()) connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    state.__mentorPortalDb = db;
  }
  return state.__mentorPortalDb;
}
