import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest({ root: "apps/extension" }) as any, react()],
  test: {
    exclude: [...configDefaults.exclude, "**/.claude/**", "**/.worktrees/**", "tests/**"],
    environment: "node",
    globals: true,
    setupFiles: "vitest.setup.ts",
    watch: false,
    testTimeout: 15_000,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: {
        statements: 63,
        branches: 56,
        functions: 55,
        lines: 65,
      },
    },
  },
});
