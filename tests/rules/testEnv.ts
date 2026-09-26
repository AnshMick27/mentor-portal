import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

/** `demo-` project ids never touch real Firebase resources. Must match `--project` in the test:rules script. */
export const RULES_TEST_PROJECT_ID = "demo-mentor-portal";

const rulesPath = fileURLToPath(new URL("../../firestore.rules", import.meta.url));

/** Starts a test environment against the running Firestore emulator (host from FIRESTORE_EMULATOR_HOST). */
export function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: RULES_TEST_PROJECT_ID,
    firestore: { rules: readFileSync(rulesPath, "utf8") },
  });
}
