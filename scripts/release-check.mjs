// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { npmInvocation } from "./npm-invocation.mjs";
import {
  RELEASE_VERSION,
  releasePackages,
  repositoryRoot,
  sorted,
} from "./release-config.mjs";

const nodeCommand = process.execPath;
const licenseBanner =
  "/*! libreconsent v1.0.0 | MIT License | SPDX-License-Identifier: MIT */";

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function runNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, options);
}

function parseTrailingJson(output, label) {
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (character !== "[" && character !== "{") {
      continue;
    }
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // Lifecycle scripts may write progress before npm's final JSON payload.
    }
  }
  fail(`${label}: npm output did not end with valid JSON`);
}

export function validateManifest(manifest, releasePackage) {
  const errors = [];
  const repository = manifest.repository;
  if (manifest.name !== releasePackage.name) {
    errors.push(`name must be ${releasePackage.name}`);
  }
  if (manifest.version !== RELEASE_VERSION) {
    errors.push(`version must be ${RELEASE_VERSION}`);
  }
  if (manifest.private !== undefined) {
    errors.push("public package must not declare private");
  }
  if (manifest.license !== "MIT") {
    errors.push("license must be MIT");
  }
  if (manifest.publishConfig?.access !== "public") {
    errors.push("publishConfig.access must be public");
  }
  if (
    repository?.type !== "git" ||
    repository?.url !==
      "git+https://github.com/nicolasestrem/libreconsent.git" ||
    repository?.directory !== releasePackage.directory
  ) {
    errors.push("repository metadata is incomplete or incorrect");
  }
  if (
    manifest.homepage !== "https://github.com/nicolasestrem/libreconsent#readme"
  ) {
    errors.push("homepage is incorrect");
  }
  if (
    manifest.bugs?.url !==
    "https://github.com/nicolasestrem/libreconsent/issues"
  ) {
    errors.push("bugs URL is incorrect");
  }
  if (
    !Array.isArray(manifest.keywords) ||
    manifest.keywords.length < 3 ||
    manifest.keywords.some(
      (keyword) => typeof keyword !== "string" || keyword.trim() === "",
    )
  ) {
    errors.push("keywords must contain at least three non-empty entries");
  }
  if (
    manifest.exports === undefined ||
    sorted(Object.keys(manifest.exports)).join(",") !== "."
  ) {
    errors.push("only the package-root export may be public");
  }
  if (manifest.scripts?.prepack !== "pnpm run build") {
    errors.push("prepack must build the package");
  }
  if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
    errors.push("runtime dependencies are not allowed in the v1 packages");
  }
  return errors;
}

export function validateTarballFiles(actualFiles, expectedFiles) {
  const actual = sorted(actualFiles);
  const expected = sorted(expectedFiles);
  return actual.length === expected.length &&
    actual.every((file, index) => file === expected[index])
    ? []
    : [
        `tarball files differ\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`,
      ];
}

function validateMetadataAndArtifacts() {
  const rootManifest = readJson(path.join(repositoryRoot, "package.json"));
  if (
    rootManifest.version !== RELEASE_VERSION ||
    rootManifest.private !== true ||
    rootManifest.license !== "MIT"
  ) {
    fail("workspace root must be private, MIT-licensed, and version 1.0.0");
  }

  const rootLicense = readFileSync(
    path.join(repositoryRoot, "LICENSE"),
    "utf8",
  );
  for (const releasePackage of releasePackages) {
    const packageRoot = path.join(repositoryRoot, releasePackage.directory);
    const manifest = readJson(path.join(packageRoot, "package.json"));
    const errors = validateManifest(manifest, releasePackage);
    if (errors.length > 0) {
      fail(`${releasePackage.name}: ${errors.join("; ")}`);
    }
    const packageLicense = readFileSync(
      path.join(packageRoot, "LICENSE"),
      "utf8",
    );
    if (
      packageLicense.replaceAll("\r\n", "\n") !==
      rootLicense.replaceAll("\r\n", "\n")
    ) {
      fail(`${releasePackage.name}: package LICENSE differs from root LICENSE`);
    }

    for (const [condition, target] of Object.entries(manifest.exports["."])) {
      const targetPath = path.join(packageRoot, target);
      try {
        readFileSync(targetPath);
      } catch {
        fail(
          `${releasePackage.name}: missing ${condition} export target ${target}`,
        );
      }
    }
    for (const file of releasePackage.files.filter((entry) =>
      entry.endsWith(".js"),
    )) {
      const source = readFileSync(path.join(packageRoot, file), "utf8");
      if (!source.startsWith(licenseBanner)) {
        fail(
          `${releasePackage.name}: ${file} is missing the preserved license banner`,
        );
      }
    }
  }

  const trackedSources = run("git", [
    "ls-files",
    "packages/**/*.ts",
    "packages/**/*.sql",
    "packages/**/*.jsonc",
  ])
    .split(/\r?\n/)
    .filter(Boolean);
  for (const sourcePath of trackedSources) {
    const source = readFileSync(path.join(repositoryRoot, sourcePath), "utf8");
    if (!source.match(/^(?:\/\/|--) SPDX-License-Identifier: MIT/)) {
      fail(`${sourcePath}: missing MIT SPDX identifier`);
    }
  }

  const workerConfigSource = readFileSync(
    path.join(repositoryRoot, "packages/worker-log/wrangler.example.jsonc"),
    "utf8",
  );
  const workerConfig = JSON.parse(
    workerConfigSource.replace(/^\s*\/\/.*$/gm, ""),
  );
  if (workerConfig.main !== "dist/index.js") {
    fail("worker package configuration must deploy dist/index.js");
  }
}

function packPackages(tempRoot) {
  const tarballs = new Map();
  for (const releasePackage of releasePackages) {
    const packageRoot = path.join(repositoryRoot, releasePackage.directory);
    const output = runNpm(["pack", "--json", "--pack-destination", tempRoot], {
      cwd: packageRoot,
    });
    const result = parseTrailingJson(output, releasePackage.name);
    if (!Array.isArray(result) || result.length !== 1) {
      fail(`${releasePackage.name}: npm pack did not return one JSON result`);
    }
    const pack = result[0];
    if (
      pack.name !== releasePackage.name ||
      pack.version !== RELEASE_VERSION ||
      typeof pack.filename !== "string" ||
      !Array.isArray(pack.files)
    ) {
      fail(`${releasePackage.name}: malformed npm pack result`);
    }
    const fileErrors = validateTarballFiles(
      pack.files.map((file) => file.path),
      releasePackage.files,
    );
    if (fileErrors.length > 0) {
      fail(`${releasePackage.name}: ${fileErrors.join("; ")}`);
    }
    tarballs.set(releasePackage.name, path.join(tempRoot, pack.filename));
  }
  return tarballs;
}

function validateTemporaryConsumer(tempRoot, tarballs) {
  const consumerRoot = path.join(tempRoot, "consumer");
  writeFileSync(
    path.join(tempRoot, "consumer-package.json"),
    JSON.stringify({
      name: "libreconsent-release-consumer",
      private: true,
      type: "module",
      dependencies: Object.fromEntries(
        [...tarballs].map(([name, tarball]) => [name, `file:${tarball}`]),
      ),
    }),
  );
  run(nodeCommand, [
    "-e",
    [
      'const fs=require("node:fs");',
      'const path=require("node:path");',
      "const [source,target]=process.argv.slice(1);",
      "fs.mkdirSync(target,{recursive:true});",
      'fs.copyFileSync(source,path.join(target,"package.json"));',
    ].join(""),
    path.join(tempRoot, "consumer-package.json"),
    consumerRoot,
  ]);
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerRoot,
  });

  const typeConsumer = `import { init, type CmpConfig } from "@libreconsent/core";
import { mount, type UiOptions } from "@libreconsent/ui";
import { initBridge, type BridgeConfig } from "@libreconsent/bridge";
import worker, { type WorkerLogModule } from "@libreconsent/worker-log";
const core: typeof init = init;
const ui: typeof mount = mount;
const bridge: typeof initBridge = initBridge;
const handler: WorkerLogModule = worker;
const config = {} as CmpConfig;
const uiOptions = {} as UiOptions;
const bridgeConfig = {} as BridgeConfig;
void [core, ui, bridge, handler, config, uiOptions, bridgeConfig];
`;
  writeFileSync(path.join(consumerRoot, "consumer.ts"), typeConsumer);
  const tscPath = path.join(
    repositoryRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );
  run(
    nodeCommand,
    [
      tscPath,
      "--noEmit",
      "--strict",
      "--target",
      "ES2020",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2023,DOM",
      "consumer.ts",
    ],
    { cwd: consumerRoot },
  );

  const runtimeConsumer = `const core = await import("@libreconsent/core");
const ui = await import("@libreconsent/ui");
const bridge = await import("@libreconsent/bridge");
const worker = await import("@libreconsent/worker-log");
if (typeof core.init !== "function" || typeof ui.mount !== "function" ||
    typeof bridge.initBridge !== "function" ||
    typeof worker.default?.fetch !== "function") {
  throw new Error("package-root runtime import is incomplete");
}
for (const specifier of [
  "@libreconsent/core/dist/index.js",
  "@libreconsent/ui/dist/index.js",
  "@libreconsent/bridge/dist/index.js",
  "@libreconsent/worker-log/dist/index.js",
]) {
  try {
    await import(specifier);
    throw new Error("unsupported deep import resolved: " + specifier);
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }
}
`;
  writeFileSync(path.join(consumerRoot, "runtime.mjs"), runtimeConsumer);
  run(nodeCommand, ["runtime.mjs"], { cwd: consumerRoot });

  const browserArtifacts = [
    ["core", "LibreConsentCore", "init"],
    ["ui", "LibreConsentUi", "mount"],
    ["bridge", "LibreConsentBridge", "initBridge"],
  ];
  for (const [packageName, globalName, member] of browserArtifacts) {
    const packageDirectory = packageName === "core" ? "core" : packageName;
    const source = readFileSync(
      path.join(
        consumerRoot,
        "node_modules",
        "@libreconsent",
        packageDirectory,
        "dist/index.global.js",
      ),
      "utf8",
    );
    const context = {
      URL,
      clearTimeout,
      console,
      crypto: globalThis.crypto,
      setTimeout,
    };
    context.window = context;
    vm.runInNewContext(source, context);
    if (typeof context[globalName]?.[member] !== "function") {
      fail(`${packageName}: expected IIFE global ${globalName}.${member}`);
    }
  }

  const headSource = readFileSync(
    path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      "core",
      "dist/head-snippet.global.js",
    ),
    "utf8",
  );
  const headWindow = {
    libreconsentConsentMode: { enabled: true },
  };
  vm.runInNewContext(headSource, { window: headWindow });
  const headCommand = Array.from(headWindow.dataLayer?.[0] ?? []);
  if (
    headCommand[0] !== "consent" ||
    headCommand[1] !== "default" ||
    headCommand[2]?.ad_user_data !== "denied"
  ) {
    fail("core: packaged head snippet did not synchronously queue v2 defaults");
  }
}

export function runReleaseCheck() {
  validateMetadataAndArtifacts();
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "libreconsent-release-"));
  try {
    const tarballs = packPackages(tempRoot);
    validateTemporaryConsumer(tempRoot, tarballs);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log(
    "Release check passed: 4 strict tarballs, public ESM/types/IIFE imports, blocked deep imports, MIT/SPDX metadata, and packaged Worker configuration.",
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runReleaseCheck();
}
