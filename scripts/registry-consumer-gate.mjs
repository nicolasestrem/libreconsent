// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { chromium } from "@playwright/test";
import { npmInvocation } from "./npm-invocation.mjs";
import { quickstartAssetPaths } from "./quickstart-assets.mjs";
import {
  RELEASE_VERSION,
  releasePackages,
  repositoryRoot,
} from "./release-config.mjs";
import {
  candidateFingerprint,
  hasGitWorktreeAncestor,
  validateExternalEmptyOutput,
} from "./release-prepare.mjs";

const RELEASE_TAG = `v${RELEASE_VERSION}`;
const PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/";
const packageNames = releasePackages.map(
  (releasePackage) => releasePackage.name,
);
const browserArtifactPrefix = "examples/vendor/libreconsent/";
const approvedBrowserArtifactDestinations = quickstartAssetPaths.map(
  (asset) => asset.destination,
);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function parseNpmJson(output, label) {
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (character !== "{" && character !== "[") continue;
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // npm can prefix progress output before its JSON response.
    }
  }
  fail(`${label}: npm output did not contain valid JSON`);
}

function assertDirectory(directory, label) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    fail(`${label} must be an existing directory`);
  }
  return realpathSync(directory);
}

function writeText(filePath, source) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
}

function assertFailed(command, args, options, label) {
  try {
    run(command, args, options);
  } catch {
    return;
  }
  fail(`${label} unexpectedly succeeded`);
}

export function publicRegistryArgs(args) {
  return [
    ...args,
    "--registry",
    PUBLIC_NPM_REGISTRY,
    `--@libreconsent:registry=${PUBLIC_NPM_REGISTRY}`,
  ];
}

export function parseRegistryConsumerArgs(argv) {
  let approval;
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--approval") {
      approval = argv[++index];
      continue;
    }
    if (argument === "--output") {
      output = argv[++index];
      continue;
    }
    fail(`unsupported argument: ${argument}`);
  }
  if (typeof approval !== "string" || !path.isAbsolute(approval)) {
    fail("--approval must name an absolute release-manifest.json path");
  }
  if (typeof output !== "string" || !path.isAbsolute(output)) {
    fail("--output must name an absolute empty directory outside repositories");
  }
  return { approval, output };
}

export function validateRegistryGateOutput(output) {
  const directory = validateExternalEmptyOutput(output);
  if (hasGitWorktreeAncestor(directory)) {
    fail("--output must be outside every Git worktree");
  }
  return directory;
}

export function validateApprovalManifest(manifest) {
  if (manifest?.schemaVersion !== 1) {
    fail("approval manifest schemaVersion must be 1");
  }
  if (manifest.tag !== RELEASE_TAG) {
    fail(`approval manifest tag must be ${RELEASE_TAG}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(manifest.commit ?? "")) {
    fail("approval manifest must contain a full approved commit SHA");
  }
  if (
    !Array.isArray(manifest.publicationOrder) ||
    manifest.publicationOrder.join("\n") !== packageNames.join("\n")
  ) {
    fail("approval manifest publication order differs from the v1 contract");
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length !== 4) {
    fail("approval manifest must contain exactly four package records");
  }
  for (const [index, packageName] of packageNames.entries()) {
    const releasePackage = manifest.packages[index];
    if (
      releasePackage?.name !== packageName ||
      releasePackage.version !== RELEASE_VERSION ||
      !/^[0-9a-f]{64}$/i.test(releasePackage.sha256 ?? "") ||
      typeof releasePackage.integrity !== "string" ||
      !releasePackage.integrity.startsWith("sha512-") ||
      !Array.isArray(releasePackage.files)
    ) {
      fail(`approval manifest package ${packageName} is incomplete`);
    }
  }
  if (
    typeof manifest.uiCorePeer !== "string" ||
    manifest.uiCorePeer !== "^1.0.0"
  ) {
    fail("approval manifest must record the UI-to-core ^1.0.0 peer");
  }
  if (!Array.isArray(manifest.browserArtifacts)) {
    fail("approval manifest must contain approved browser artifacts");
  }
  for (const artifact of manifest.browserArtifacts) {
    const relative =
      typeof artifact?.destination === "string"
        ? artifact.destination.slice(browserArtifactPrefix.length)
        : "";
    if (
      typeof artifact?.destination !== "string" ||
      !artifact.destination.startsWith(browserArtifactPrefix) ||
      !/^[0-9a-f]{64}$/i.test(artifact.sha256 ?? "") ||
      relative.split("/").some((segment) => segment === "" || segment === "..")
    ) {
      fail("approval manifest contains an invalid browser artifact record");
    }
  }
  if (
    manifest.browserArtifacts
      .map((artifact) => artifact.destination)
      .sort()
      .join("\n") !==
    approvedBrowserArtifactDestinations.slice().sort().join("\n")
  ) {
    fail(
      "approval manifest browser artifacts differ from the Phase 3A contract",
    );
  }
  if (
    typeof manifest.releaseNotes !== "string" ||
    manifest.releaseNotes.trim() === "" ||
    !Array.isArray(manifest.knownLimits) ||
    manifest.knownLimits.length === 0
  ) {
    fail("approval manifest must retain release notes and known limits");
  }

  const {
    candidateFingerprint: approvedFingerprint,
    preparedAt,
    schemaVersion,
    ...candidate
  } = manifest;
  if (
    typeof approvedFingerprint !== "string" ||
    candidateFingerprint(candidate) !== approvedFingerprint
  ) {
    fail("approval manifest candidate fingerprint is invalid or stale");
  }
  return manifest;
}

function readApprovedManifest(approvalPath) {
  if (!existsSync(approvalPath) || !statSync(approvalPath).isFile()) {
    fail("--approval must name an existing release-manifest.json file");
  }
  const resolvedApproval = realpathSync(approvalPath);
  if (isInside(realpathSync(repositoryRoot), resolvedApproval)) {
    fail("--approval must be outside the release repository");
  }
  if (hasGitWorktreeAncestor(path.dirname(resolvedApproval))) {
    fail("--approval must be outside every Git worktree");
  }
  return validateApprovalManifest(readJson(resolvedApproval));
}

function verifyRegistryPackage(manifestPackage) {
  const output = runNpm(
    publicRegistryArgs([
      "view",
      `${manifestPackage.name}@${RELEASE_VERSION}`,
      "--json",
    ]),
  );
  const registryPackage = parseNpmJson(output, manifestPackage.name);
  if (
    registryPackage?.name !== manifestPackage.name ||
    registryPackage.version !== RELEASE_VERSION ||
    registryPackage.dist?.integrity !== manifestPackage.integrity
  ) {
    fail(
      `${manifestPackage.name}: registry version or integrity differs from the approved tarball`,
    );
  }
}

function assertInstalledFromPublicRegistry(consumerRoot) {
  const packageLock = readJson(path.join(consumerRoot, "package-lock.json"));
  for (const packageName of [
    "@libreconsent/core",
    "@libreconsent/ui",
    "@libreconsent/bridge",
  ]) {
    const resolved =
      packageLock.packages?.[`node_modules/${packageName}`]?.resolved;
    if (
      typeof resolved !== "string" ||
      !resolved.startsWith(PUBLIC_NPM_REGISTRY)
    ) {
      fail(
        `${packageName}: consumer was not installed from the public npm registry`,
      );
    }
  }
}

function writeConsumerProject(consumerRoot) {
  writeText(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "libreconsent-v1-registry-consumer-gate",
        private: true,
        type: "module",
        dependencies: {
          "@libreconsent/bridge": RELEASE_VERSION,
          "@libreconsent/core": RELEASE_VERSION,
          "@libreconsent/ui": RELEASE_VERSION,
        },
        devDependencies: {
          typescript: "5.9.3",
          vite: "7.0.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeText(
    path.join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          target: "ES2020",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeText(
    path.join(consumerRoot, "vite.config.ts"),
    'import { defineConfig } from "vite";\n\nexport default defineConfig({ base: "./" });\n',
  );
  writeText(
    path.join(consumerRoot, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      window.libreconsentConsentMode = { enabled: true };
    </script>
    <script src="./vendor/libreconsent/core/head-snippet.global.js"></script>
    <title>libreconsent registry consumer gate</title>
  </head>
  <body>
    <main id="app">Loading installed package roots…</main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  );
  writeText(
    path.join(consumerRoot, "src/main.ts"),
    `import { init } from "@libreconsent/core";
import { mount } from "@libreconsent/ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("consumer mount point is missing");
app.dataset.coreImport = typeof init;
app.dataset.uiImport = typeof mount;
app.textContent = "Installed package-root imports resolved.";
`,
  );
  writeText(
    path.join(consumerRoot, "root-imports.ts"),
    `import {
  init,
  type CmpConfig,
  type ConsentModeMappingValue,
  type FixedDeniedConsentModeMapping,
} from "@libreconsent/core";
import { mount, type UiOptions } from "@libreconsent/ui";

const core: typeof init = init;
const ui: typeof mount = mount;
const config = {} as CmpConfig;
const fixed: FixedDeniedConsentModeMapping = { mode: "fixed", value: "denied" };
const mapping: ConsentModeMappingValue = fixed;
const options = {} as UiOptions;
void [core, ui, config, fixed, mapping, options];
`,
  );
  writeText(
    path.join(consumerRoot, "deep-import.ts"),
    'import type { ConsentCategory } from "@libreconsent/core/dist/index.js";\nvoid (null as unknown as ConsentCategory);\n',
  );
  writeText(
    path.join(consumerRoot, "runtime.mjs"),
    `const core = await import("@libreconsent/core");
const ui = await import("@libreconsent/ui");
if (typeof core.init !== "function" || typeof ui.mount !== "function") {
  throw new Error("package-root ESM imports are incomplete");
}
for (const specifier of [
  "@libreconsent/core/dist/index.js",
  "@libreconsent/ui/dist/index.js",
]) {
  try {
    await import(specifier);
    throw new Error("unsupported deep import resolved: " + specifier);
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }
}
`,
  );
}

function listInstalledCoreDirectories(consumerRoot) {
  const directories = [];
  const visited = new Set();
  function visitPackage(packageRoot) {
    const resolvedPackage = realpathSync(packageRoot);
    if (visited.has(resolvedPackage)) return;
    visited.add(resolvedPackage);
    const nodeModules = path.join(resolvedPackage, "node_modules");
    if (!existsSync(nodeModules)) return;
    const coreDirectory = path.join(nodeModules, "@libreconsent", "core");
    if (existsSync(coreDirectory) && statSync(coreDirectory).isDirectory()) {
      directories.push(realpathSync(coreDirectory));
    }
    for (const entry of readdirSync(nodeModules, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      const entryPath = path.join(nodeModules, entry.name);
      if (entry.name.startsWith("@")) {
        for (const scopedEntry of readdirSync(entryPath, {
          withFileTypes: true,
        })) {
          if (scopedEntry.isDirectory()) {
            visitPackage(path.join(entryPath, scopedEntry.name));
          }
        }
      } else {
        visitPackage(entryPath);
      }
    }
  }
  visitPackage(consumerRoot);
  return [...new Set(directories)].sort();
}

function verifyInstalledPackages(consumerRoot) {
  const coreManifest = readJson(
    path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      "core",
      "package.json",
    ),
  );
  const uiManifest = readJson(
    path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      "ui",
      "package.json",
    ),
  );
  const bridgeManifest = readJson(
    path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      "bridge",
      "package.json",
    ),
  );
  if (
    coreManifest.version !== RELEASE_VERSION ||
    uiManifest.version !== RELEASE_VERSION ||
    bridgeManifest.version !== RELEASE_VERSION
  ) {
    fail("installed core/UI/bridge versions are not exactly 1.0.0");
  }
  const coreDirectories = listInstalledCoreDirectories(consumerRoot);
  if (coreDirectories.length !== 1) {
    fail(
      `consumer must contain exactly one compatible core installation, found ${coreDirectories.length}`,
    );
  }
}

function verifyRootImportsAndHeadBootstrap(consumerRoot) {
  const tscPath = path.join(
    consumerRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );
  const compilerArgs = [
    tscPath,
    "--noEmit",
    "--strict",
    "--target",
    "ES2020",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
  ];
  run(process.execPath, [...compilerArgs, "root-imports.ts"], {
    cwd: consumerRoot,
  });
  assertFailed(
    process.execPath,
    [...compilerArgs, "deep-import.ts"],
    { cwd: consumerRoot },
    "TypeScript deep import",
  );
  run(process.execPath, ["runtime.mjs"], { cwd: consumerRoot });

  const source = readFileSync(
    path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      "core",
      "dist",
      "head-snippet.global.js",
    ),
    "utf8",
  );
  const headWindow = {
    libreconsentConsentMode: { enabled: true },
  };
  vm.runInNewContext(source, { window: headWindow });
  const command = Array.from(headWindow.dataLayer?.[0] ?? []);
  const defaults = command[2];
  const signals = [
    "ad_storage",
    "analytics_storage",
    "ad_user_data",
    "ad_personalization",
  ];
  if (
    command[0] !== "consent" ||
    command[1] !== "default" ||
    !signals.every((signal) => defaults?.[signal] === "denied")
  ) {
    fail("installed head bootstrap did not synchronously emit denied defaults");
  }
}

function installApprovedBrowserArtifacts(consumerRoot, manifest) {
  const publicRoot = path.join(consumerRoot, "public");
  for (const artifact of manifest.browserArtifacts) {
    const relative = artifact.destination.slice(browserArtifactPrefix.length);
    const segments = relative.split("/");
    const packageName = segments.shift();
    if (!packageName || !["core", "ui", "bridge"].includes(packageName)) {
      fail(`unsupported approved browser artifact ${artifact.destination}`);
    }
    if (segments.length === 0 || segments.some((segment) => segment === "..")) {
      fail(`invalid approved browser artifact ${artifact.destination}`);
    }
    const installedPath = path.join(
      consumerRoot,
      "node_modules",
      "@libreconsent",
      packageName,
      "dist",
      ...segments,
    );
    if (
      !existsSync(installedPath) ||
      sha256(installedPath) !== artifact.sha256
    ) {
      fail(
        `${artifact.destination}: installed browser artifact differs from the approved Phase 3A copy`,
      );
    }
    const destination = path.join(
      publicRoot,
      "vendor",
      "libreconsent",
      relative,
    );
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(installedPath, destination);
  }
}

function buildViteConsumer(consumerRoot) {
  const vitePath = path.join(
    consumerRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  run(process.execPath, [vitePath, "build"], { cwd: consumerRoot });
}

function startStaticServer(root) {
  const staticRoot = assertDirectory(root, "consumer dist directory");
  const server = createServer((request, response) => {
    if (
      !request.url ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    const requested =
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const candidate = path.resolve(staticRoot, requested);
    if (
      path.relative(staticRoot, candidate).startsWith("..") ||
      candidate === staticRoot ||
      !existsSync(candidate) ||
      !statSync(candidate).isFile()
    ) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type":
        mimeTypes[path.extname(candidate)] ?? "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(candidate).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "string" || !address) {
        reject(new Error("ordinary static server did not expose a TCP port"));
        return;
      }
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, server });
    });
  });
}

async function verifyStaticConsumer(consumerRoot) {
  const { baseUrl, server } = await startStaticServer(
    path.join(consumerRoot, "dist"),
  );
  try {
    const name = "chromium";
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const pageErrors = [];
      const vendorRequests = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        if (request.url().includes("/vendor/libreconsent/")) {
          vendorRequests.push(request.url());
        }
      });
      const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
      if (response?.status() !== 200) {
        fail(`${name}: ordinary static consumer did not return index.html`);
      }
      if (
        (await page.locator("#app").textContent()) !==
        "Installed package-root imports resolved."
      ) {
        fail(
          `${name}: Vite consumer did not execute installed package imports`,
        );
      }
      const defaults = await page.evaluate(() => window.dataLayer?.[0]?.[2]);
      if (
        ![
          "ad_storage",
          "analytics_storage",
          "ad_user_data",
          "ad_personalization",
        ].every((signal) => defaults?.[signal] === "denied")
      ) {
        fail(`${name}: installed head bootstrap defaults are not denied`);
      }
      if (vendorRequests.length === 0) {
        fail(
          `${name}: ordinary static consumer did not load a relative vendor artifact`,
        );
      }
      const obsolete = await page.request.get(`${baseUrl}/dist/core.global.js`);
      if (obsolete.status() !== 404) {
        fail(`${name}: obsolete /dist/core.global.js request must return 404`);
      }
      if (pageErrors.length > 0) {
        fail(`${name}: browser page errors: ${pageErrors.join("; ")}`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export async function runRegistryConsumerGate({ approval, output }) {
  const manifest = readApprovedManifest(approval);
  const outputDirectory = validateRegistryGateOutput(output);
  const corePackage = manifest.packages.find(
    (releasePackage) => releasePackage.name === "@libreconsent/core",
  );
  const uiPackage = manifest.packages.find(
    (releasePackage) => releasePackage.name === "@libreconsent/ui",
  );
  const bridgePackage = manifest.packages.find(
    (releasePackage) => releasePackage.name === "@libreconsent/bridge",
  );
  verifyRegistryPackage(corePackage);
  verifyRegistryPackage(uiPackage);
  verifyRegistryPackage(bridgePackage);

  const consumerRoot = path.join(outputDirectory, "consumer");
  mkdirSync(consumerRoot);
  writeConsumerProject(consumerRoot);
  runNpm(
    publicRegistryArgs([
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ]),
    { cwd: consumerRoot },
  );
  assertInstalledFromPublicRegistry(consumerRoot);
  verifyInstalledPackages(consumerRoot);
  verifyRootImportsAndHeadBootstrap(consumerRoot);
  installApprovedBrowserArtifacts(consumerRoot, manifest);
  buildViteConsumer(consumerRoot);
  await verifyStaticConsumer(consumerRoot);

  writeText(
    path.join(outputDirectory, "registry-consumer-evidence.json"),
    `${JSON.stringify(
      {
        approvalFingerprint: manifest.candidateFingerprint,
        commit: manifest.commit,
        completedAt: new Date().toISOString(),
        packageVersions: {
          "@libreconsent/core": RELEASE_VERSION,
          "@libreconsent/ui": RELEASE_VERSION,
        },
        tag: RELEASE_TAG,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Registry consumer gate passed for ${RELEASE_TAG}. The external consumer is preserved in ${outputDirectory}.`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await runRegistryConsumerGate(
    parseRegistryConsumerArgs(process.argv.slice(2)),
  );
}
