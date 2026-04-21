import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: [
        "src/application/**/*.js",
        "src/utils/**/*.js",
        "src/config/env.js",
        "src/config/jwt.js"
      ],
      exclude: ["**/*.test.js"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  }
});
