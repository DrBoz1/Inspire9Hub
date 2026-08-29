import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    // Mirror the "@/*" -> "./*" alias from tsconfig.json so tests import the same
    // modules the app does, rather than a copy that can drift.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
