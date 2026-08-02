import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["e2e/**", "e2e-auth/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/lib/food-math.ts", "src/lib/open-food-facts.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85
      }
    }
  }
});
