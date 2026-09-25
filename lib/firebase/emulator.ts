/** Local emulator endpoints; must match the ports in firebase.json. */
export const EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;

/** Emulators are used only when explicitly enabled AND not in a production build. */
export function shouldUseEmulator(flag: string | undefined, nodeEnv: string | undefined): boolean {
  return flag?.trim().toLowerCase() === "true" && nodeEnv !== "production";
}
