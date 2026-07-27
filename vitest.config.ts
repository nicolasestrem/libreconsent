import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the tsconfig `paths` mapping: tests run before `pnpm build`,
      // so the workspace package must resolve to source rather than `dist/`.
      "@libreconsent/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["packages/*/src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
