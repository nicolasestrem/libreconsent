// SPDX-License-Identifier: MIT
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  target: "es2020",
  minify: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  globalName: "LibreConsentBridge",
  banner: {
    js: "/*! libreconsent v1.1.0 | MIT License | SPDX-License-Identifier: MIT */",
  },
});
