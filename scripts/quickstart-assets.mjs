// SPDX-License-Identifier: MIT
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const copyableConsentModeQuickstarts = [
  "examples/quickstarts/basic-consent-mode/index.html",
  "examples/quickstarts/gtm-basic-mode/index.html",
  "examples/quickstarts/us-only-opt-out/index.html",
];
const headArtifactPath = "packages/core/dist/head-snippet.global.js";
const sourceMappingComment = /\n?\/\/# sourceMappingURL=.*$/m;
const embeddedArtifactPattern =
  /<script data-libreconsent-head-artifact>[\s\S]*?<\/script>/;
const embeddedArtifactPreamble =
  "// biome-ignore-all format: preserve the exact packaged bootstrap\n" +
  "// biome-ignore-all lint: preserve the exact packaged bootstrap\n";

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

export function syncQuickstartHeadArtifacts(root = repositoryRoot) {
  const artifact = readFileSync(path.join(root, headArtifactPath), "utf8")
    .replace(sourceMappingComment, "")
    .trim();
  for (const quickstart of copyableConsentModeQuickstarts) {
    const quickstartPath = path.join(root, quickstart);
    const html = readFileSync(quickstartPath, "utf8");
    const replacement =
      `<script data-libreconsent-head-artifact>\n${embeddedArtifactPreamble}` +
      `${artifact}\n    </script>`;
    if (!embeddedArtifactPattern.test(html)) {
      throw new Error(`${quickstart}: inline head artifact is missing`);
    }
    writeFileSync(
      quickstartPath,
      html.replace(embeddedArtifactPattern, replacement),
    );
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  syncQuickstartAssets();
  syncQuickstartHeadArtifacts();
  console.log(
    `Synchronized ${quickstartAssetPaths.length} exact quickstart browser assets and ${copyableConsentModeQuickstarts.length} inline head artifacts.`,
  );
}
