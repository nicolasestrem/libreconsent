// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { failUsage, reportUsageError } from "./cli-usage.mjs";
import { npmInvocation } from "./npm-invocation.mjs";
import { quickstartAssetPairs } from "./quickstart-assets.mjs";
import {
  validateManifest,
  validateReleaseCandidate,
  validateTarballFiles,
} from "./release-check.mjs";
import {
  RELEASE_VERSION,
  releasePackages,
  repositoryRoot,
  sorted,
} from "./release-config.mjs";

const RELEASE_TAG = `v${RELEASE_VERSION}`;

/**
 * The single contract every `--output` directory must satisfy. Both this
 * script and the registry consumer gate report it verbatim, followed by the
 * specific part that was not met, so an operator never has to reconcile
 * several near-identical wordings.
 */
export const OUTPUT_REQUIREMENT =
  "--output must be an absolute path to an existing empty directory outside " +
  "this repository and outside every Git worktree";

// Derived from the configured version: this is the sentence the owner signs,
// so a pinned version would ask them to approve tagging a release other than
// the one actually prepared.
const approvalSentence = `I explicitly approve tagging this SHA as ${RELEASE_TAG} and publishing exactly these four preserved tarballs in this order.`;

export const knownReleaseLimits = [
  "No production TCF or GPP implementation.",
  "Not a certified AdSense CMP.",
  "Decision receipts remain opt-in.",
  "Real-domain AdSense bridge interoperability is not yet proven.",
  "Exact Safari 15.4 hardware behavior remains unverified.",
];

function fail(message) {
  throw new Error(message);
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

function runGit(args) {
  return run("git", args);
}

function runNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, options);
}

function runPnpm(args) {
  if (process.platform === "win32") {
    const command = process.env.ComSpec;
    if (!command) fail("ComSpec is required to run pnpm on Windows");
    return run(command, ["/d", "/s", "/c", "pnpm", ...args]);
  }
  return run("pnpm", args);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function parseTrailingJson(output, label) {
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (character !== "[" && character !== "{") continue;
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // npm lifecycle output can precede its final JSON payload.
    }
  }
  fail(`${label}: npm output did not contain valid JSON`);
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

export function hasGitWorktreeAncestor(directory) {
  let current = directory;
  while (true) {
    if (existsSync(path.join(current, ".git"))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/**
 * Reject an `--output` value, always restating the whole contract before the
 * part that was not met.
 *
 * @param {string} reason Clause naming what is wrong with the given path.
 * @returns {never}
 */
export function failOutput(reason) {
  failUsage(`${OUTPUT_REQUIREMENT}; ${reason}`);
}

export function parseReleasePrepareArgs(argv) {
  let expectedSha;
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--expected-sha") {
      expectedSha = argv[++index];
      continue;
    }
    if (argument === "--output") {
      output = argv[++index];
      continue;
    }
    failUsage(`unsupported argument: ${argument}`);
  }
  if (typeof expectedSha !== "string" || !/^[0-9a-f]{40}$/i.test(expectedSha)) {
    failUsage("--expected-sha must be a full 40-character commit SHA");
  }
  if (typeof output !== "string" || output.trim() === "") {
    failOutput("no directory was given");
  }
  return { expectedSha: expectedSha.toLowerCase(), output };
}

export function validateExternalEmptyOutput(output, root = repositoryRoot) {
  if (!path.isAbsolute(output)) {
    failOutput("the given path is relative");
  }
  if (!existsSync(output)) {
    failOutput("the given directory does not exist");
  }
  const resolvedOutput = realpathSync(output);
  const resolvedRoot = realpathSync(root);
  if (!statSync(resolvedOutput).isDirectory()) {
    failOutput("the given path is not a directory");
  }
  if (isInside(resolvedRoot, resolvedOutput)) {
    failOutput("the given directory is inside this repository");
  }
  if (hasGitWorktreeAncestor(resolvedOutput)) {
    failOutput("the given directory is inside a Git worktree");
  }
  if (readdirSync(resolvedOutput).length > 0) {
    failOutput("the given directory is not empty");
  }
  return resolvedOutput;
}

export function parseReleaseNotes(changelog) {
  const unreleased = changelog.match(
    /^## \[Unreleased\]\r?\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m,
  );
  if (!unreleased) fail("CHANGELOG.md must contain an [Unreleased] section");
  if (unreleased[1].trim() !== "") {
    fail("CHANGELOG.md [Unreleased] must be empty before release preparation");
  }

  // Derived from the configured version rather than pinned to one release, so
  // a version bump cannot leave preparation quietly reading an older section's
  // notes into a newer release.
  const heading = RELEASE_VERSION.replace(/\./g, "\\.");
  const release = changelog.match(
    new RegExp(
      `^## \\[${heading}\\] - (\\d{4}-\\d{2}-\\d{2})\\r?\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`,
      "m",
    ),
  );
  if (!release || release[2].trim() === "") {
    fail(
      `CHANGELOG.md must contain a non-empty dated [${RELEASE_VERSION}] section`,
    );
  }
  return { date: release[1], notes: release[2].trim() };
}

function isDetachedHead() {
  try {
    runGit(["symbolic-ref", "-q", "HEAD"]);
    return false;
  } catch {
    return true;
  }
}

function assertCleanDetachedExpectedCommit(expectedSha) {
  const head = runGit(["rev-parse", "HEAD"]).trim().toLowerCase();
  if (head !== expectedSha) {
    failUsage(`HEAD ${head} does not match --expected-sha ${expectedSha}`);
  }
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.trim() !== "") {
    failUsage(
      "release preparation requires a clean tracked and untracked worktree",
    );
  }
  if (!isDetachedHead()) {
    failUsage(
      "release preparation requires a detached HEAD at the approved SHA",
    );
  }
}

function assertStillClean() {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.trim() !== "") {
    fail("release preparation changed the repository worktree");
  }
}

function browserArtifactHashes() {
  return quickstartAssetPairs(repositoryRoot).map((asset) => ({
    destination: asset.destination,
    sha256: sha256(asset.destinationPath),
    source: asset.source,
  }));
}

function packPackage(releasePackage, stagingDirectory) {
  const packageRoot = path.join(repositoryRoot, releasePackage.directory);
  const manifest = readJson(path.join(packageRoot, "package.json"));
  const manifestErrors = validateManifest(manifest, releasePackage);
  if (manifestErrors.length > 0) {
    fail(`${releasePackage.name}: ${manifestErrors.join("; ")}`);
  }
  const output = runNpm(
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      stagingDirectory,
    ],
    { cwd: packageRoot },
  );
  const packed = parseTrailingJson(output, releasePackage.name);
  if (!Array.isArray(packed) || packed.length !== 1) {
    fail(`${releasePackage.name}: npm pack did not return one JSON result`);
  }
  const result = packed[0];
  if (
    result.name !== releasePackage.name ||
    result.version !== RELEASE_VERSION ||
    typeof result.filename !== "string" ||
    typeof result.integrity !== "string" ||
    !result.integrity.startsWith("sha512-") ||
    !Number.isSafeInteger(result.size) ||
    result.size <= 0 ||
    !Number.isSafeInteger(result.unpackedSize) ||
    result.unpackedSize <= 0 ||
    !Array.isArray(result.files)
  ) {
    fail(`${releasePackage.name}: npm pack result is incomplete`);
  }
  const fileErrors = validateTarballFiles(
    result.files.map((file) => file.path),
    releasePackage.files,
  );
  if (fileErrors.length > 0) {
    fail(`${releasePackage.name}: ${fileErrors.join("; ")}`);
  }
  const tarballPath = path.join(stagingDirectory, result.filename);
  if (!existsSync(tarballPath)) {
    fail(`${releasePackage.name}: npm pack did not create ${result.filename}`);
  }
  const integrity = `sha512-${createHash("sha512")
    .update(readFileSync(tarballPath))
    .digest("base64")}`;
  if (integrity !== result.integrity) {
    fail(
      `${releasePackage.name}: npm pack integrity does not match the tarball`,
    );
  }
  return {
    exports: manifest.exports,
    files: sorted(result.files.map((file) => file.path)),
    filename: result.filename,
    integrity: result.integrity,
    name: result.name,
    packedSize: result.size,
    peerDependencies: manifest.peerDependencies ?? {},
    sha256: sha256(tarballPath),
    unpackedSize: result.unpackedSize,
    version: result.version,
    tarballPath,
  };
}

export function candidateFingerprint(candidate) {
  return createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
}

function markdownList(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

export function renderApprovalManifest(manifest) {
  const packageRows = manifest.packages
    .map(
      (releasePackage) =>
        `| ${releasePackage.name} | ${releasePackage.filename} | \`${releasePackage.sha256}\` | ${releasePackage.integrity} | ${releasePackage.packedSize} | ${releasePackage.unpackedSize} |`,
    )
    .join("\n");
  const artifactRows = manifest.browserArtifacts
    .map((artifact) => `| ${artifact.destination} | \`${artifact.sha256}\` |`)
    .join("\n");
  return (
    `# libreconsent ${RELEASE_TAG} release approval\n\n` +
    `Candidate fingerprint: \`${manifest.candidateFingerprint}\`\n\n` +
    `- Approved commit: \`${manifest.commit}\`\n` +
    `- Tag: \`${manifest.tag}\`\n` +
    `- Artifact freeze date (UTC): ${manifest.artifactFreezeDate}\n` +
    `- Publication order: ${manifest.publicationOrder.join(" → ")}\n` +
    `- UI-to-core peer: \`${manifest.uiCorePeer}\`\n\n` +
    `## Preserved tarballs\n\n` +
    `| Package | Tarball | SHA-256 | npm integrity | Packed bytes | Unpacked bytes |\n` +
    `|---|---|---|---|---:|---:|\n${packageRows}\n\n` +
    `## Package files and exports\n\n` +
    manifest.packages
      .map(
        (releasePackage) =>
          `### ${releasePackage.name}\n\n` +
          `Exports: \`${JSON.stringify(releasePackage.exports)}\`\n\n` +
          `Files:\n${markdownList(releasePackage.files)}`,
      )
      .join("\n\n") +
    `\n\n## Approved browser artifacts\n\n` +
    `| Tracked copy | SHA-256 |\n|---|---|\n${artifactRows}\n\n` +
    `## Release notes\n\n${manifest.releaseNotes}\n\n` +
    `## Known limits\n\n${markdownList(manifest.knownLimits)}\n\n` +
    `## Required owner approval\n\n${approvalSentence}\n\n` +
    `Any candidate change, including a commit, tarball, artifact, file list, export, peer, release note, limit, or hash change, invalidates this manifest and requires a fresh preparation and approval.\n`
  );
}

export function prepareRelease({ expectedSha, output }) {
  const outputDirectory = validateExternalEmptyOutput(output);
  assertCleanDetachedExpectedCommit(expectedSha);
  const changelog = parseReleaseNotes(
    readFileSync(path.join(repositoryRoot, "CHANGELOG.md"), "utf8"),
  );

  runPnpm(["-r", "--if-present", "build"]);
  assertStillClean();
  validateReleaseCandidate();

  const stagingDirectory = mkdtempSync(
    path.join(os.tmpdir(), "libreconsent-release-prepare-"),
  );
  try {
    const packages = releasePackages.map((releasePackage) =>
      packPackage(releasePackage, stagingDirectory),
    );
    assertStillClean();
    for (const releasePackage of packages) {
      copyFileSync(
        releasePackage.tarballPath,
        path.join(outputDirectory, releasePackage.filename),
      );
    }
    const manifestCandidate = {
      artifactFreezeDate: changelog.date,
      browserArtifacts: browserArtifactHashes(),
      commit: expectedSha,
      knownLimits: knownReleaseLimits,
      packages: packages.map(
        ({ tarballPath, ...releasePackage }) => releasePackage,
      ),
      publicationOrder: releasePackages.map(
        (releasePackage) => releasePackage.name,
      ),
      releaseNotes: changelog.notes,
      tag: RELEASE_TAG,
      uiCorePeer: packages.find(
        (releasePackage) => releasePackage.name === "@libreconsent/ui",
      )?.peerDependencies["@libreconsent/core"],
    };
    const manifest = {
      ...manifestCandidate,
      candidateFingerprint: candidateFingerprint(manifestCandidate),
      preparedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    writeFileSync(
      path.join(outputDirectory, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(outputDirectory, "RELEASE_APPROVAL.md"),
      renderApprovalManifest(manifest),
    );
    console.log(
      `Prepared ${packages.length} preserved ${RELEASE_TAG} tarballs in ${outputDirectory}. Approval is required before tagging or publication.`,
    );
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

const USAGE =
  "Usage: pnpm release:prepare --expected-sha <40-character commit SHA> " +
  "--output <absolute empty directory>";

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    prepareRelease(parseReleasePrepareArgs(process.argv.slice(2)));
  } catch (error) {
    reportUsageError(error, "Release preparation did not start:", USAGE);
  }
}
