// SPDX-License-Identifier: MIT
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

export const quickstartAssetPaths = [
  {
    destination: "examples/vendor/libreconsent/core/index.global.js",
    source: "packages/core/dist/index.global.js",
  },
  {
    destination: "examples/vendor/libreconsent/core/index.global.js.map",
    source: "packages/core/dist/index.global.js.map",
  },
  {
    destination: "examples/vendor/libreconsent/core/head-snippet.global.js",
    source: "packages/core/dist/head-snippet.global.js",
  },
  {
    destination: "examples/vendor/libreconsent/core/head-snippet.global.js.map",
    source: "packages/core/dist/head-snippet.global.js.map",
  },
  {
    destination: "examples/vendor/libreconsent/ui/index.global.js",
    source: "packages/ui/dist/index.global.js",
  },
  {
    destination: "examples/vendor/libreconsent/ui/index.global.js.map",
    source: "packages/ui/dist/index.global.js.map",
  },
  {
    destination: "examples/vendor/libreconsent/bridge/index.global.js",
    source: "packages/bridge/dist/index.global.js",
  },
  {
    destination: "examples/vendor/libreconsent/bridge/index.global.js.map",
    source: "packages/bridge/dist/index.global.js.map",
  },
];

export function quickstartAssetPairs(root = repositoryRoot) {
  return quickstartAssetPaths.map(({ destination, source }) => ({
    destination,
    destinationPath: path.join(root, destination),
    source,
    sourcePath: path.join(root, source),
  }));
}

export function syncQuickstartAssets(root = repositoryRoot) {
  for (const asset of quickstartAssetPairs(root)) {
    mkdirSync(path.dirname(asset.destinationPath), { recursive: true });
    copyFileSync(asset.sourcePath, asset.destinationPath);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  syncQuickstartAssets();
  console.log(
    `Synchronized ${quickstartAssetPaths.length} exact quickstart browser assets.`,
  );
}
