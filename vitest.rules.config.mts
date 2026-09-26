import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Firestore rules tests. Run only inside `firebase emulators:exec` (see the `test:rules` script).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    reporters: ["verbose"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
