// SPDX-License-Identifier: MIT
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_VERSION = "1.0.0";
export const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

const commonFiles = ["LICENSE", "README.md", "package.json"];

export const releasePackages = [
  {
    directory: "packages/core",
    name: "@libreconsent/core",
    files: [
      ...commonFiles,
      "dist/head-snippet.d.ts",
      "dist/head-snippet.global.js",
      "dist/head-snippet.global.js.map",
      "dist/head-snippet.js",
      "dist/head-snippet.js.map",
      "dist/index.d.ts",
      "dist/index.global.js",
      "dist/index.global.js.map",
      "dist/index.js",
      "dist/index.js.map",
    ],
  },
  {
    directory: "packages/ui",
    name: "@libreconsent/ui",
    peerDependencies: {
      "@libreconsent/core": "^1.0.0",
    },
    files: [
      ...commonFiles,
      "dist/index.d.ts",
      "dist/index.global.js",
      "dist/index.global.js.map",
      "dist/index.js",
      "dist/index.js.map",
    ],
  },
  {
    directory: "packages/bridge",
    name: "@libreconsent/bridge",
    files: [
      ...commonFiles,
      "dist/index.d.ts",
      "dist/index.global.js",
      "dist/index.global.js.map",
      "dist/index.js",
      "dist/index.js.map",
    ],
  },
  {
    directory: "packages/worker-log",
    name: "@libreconsent/worker-log",
    files: [
      ...commonFiles,
      "dist/index.d.ts",
      "dist/index.js",
      "dist/index.js.map",
      "migrations/0001_create_consent_receipts.sql",
      "wrangler.example.jsonc",
    ],
  },
];

export function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
