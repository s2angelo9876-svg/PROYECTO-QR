import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: [
      "node_modules",
      ".next",
      "tests/e2e/**",
      ...(process.env.SCA_RUN_INTEGRATION === "true"
        ? []
        : ["tests/integration/**"]),
    ],
    env: {
      REDIS_URL: "",
      SCA_DEMO_MODE: "true",
      JWT_SECRET: "unit-tests-only-not-a-production-secret-32chars",
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
