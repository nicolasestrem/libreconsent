import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "head-snippet": "src/head-snippet.ts",
  },
  format: ["esm", "iife"],
  target: "es2020",
  minify: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  globalName: "LibreConsentCore",
});
