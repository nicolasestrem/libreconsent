// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { UsageError } from "./cli-usage.mjs";
import { npmInvocation } from "./npm-invocation.mjs";
import { quickstartAssetPaths } from "./quickstart-assets.mjs";
import {
  assertSafeArguments,
  parseRegistryConsumerArgs,
  publicRegistryArgs,
  validateApprovalManifest,
} from "./registry-consumer-gate.mjs";
import { RELEASE_VERSION, releasePackages } from "./release-config.mjs";
import {
  candidateFingerprint,
  OUTPUT_REQUIREMENT,
} from "./release-prepare.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function approvedManifest() {
  const candidate = {
    artifactFreezeDate: "2026-07-29",
    browserArtifacts: quickstartAssetPaths.map((asset) => ({
      destination: asset.destination,
      sha256: "a".repeat(64),
    })),
    commit: "0123456789abcdef0123456789abcdef01234567",
    knownLimits: ["Known limit."],
    packages: releasePackages.map((releasePackage) => ({
      files: releasePackage.files,
      integrity: "sha512-approved",
      name: releasePackage.name,
      sha256: "b".repeat(64),
      version: RELEASE_VERSION,
    })),
    publicationOrder: releasePackages.map(
      (releasePackage) => releasePackage.name,
    ),
    releaseNotes: "### Added\n\n- Released.",
    tag: `v${RELEASE_VERSION}`,
    uiCorePeer: "^1.0.0",
  };
  return {
    ...candidate,
    candidateFingerprint: candidateFingerprint(candidate),
    preparedAt: "2026-07-29T00:00:00.000Z",
    schemaVersion: 1,
  };
}

describe("registry consumer gate", () => {
  test("requires absolute approval and external output paths", () => {
    const approval = path.resolve("release", "release-manifest.json");
    const output = path.resolve("registry-gate");
    expect(
      parseRegistryConsumerArgs(["--approval", approval, "--output", output]),
    ).toEqual({
      approval,
      output,
    });
    expect(() =>
      parseRegistryConsumerArgs(["--approval", "relative.json"]),
    ).toThrow(UsageError);
    expect(() =>
      parseRegistryConsumerArgs(["--approval", "relative.json"]),
    ).toThrow("the given path is relative");
    expect(() =>
      parseRegistryConsumerArgs(["--approval", approval, "--output", "gate"]),
    ).toThrow(`${OUTPUT_REQUIREMENT}; the given path is relative`);
    expect(() => parseRegistryConsumerArgs(["--unknown"])).toThrow(
      "unsupported argument: --unknown",
    );
  });

  test("pins npm lookup and installation arguments to the public registry", () => {
    expect(publicRegistryArgs(["view", "@libreconsent/core@1.0.0"])).toEqual([
      "view",
      "@libreconsent/core@1.0.0",
      "--registry",
      "https://registry.npmjs.org/",
      "--@libreconsent:registry=https://registry.npmjs.org/",
    ]);
  });

  test("accepts only an intact four-package approval manifest", () => {
    const manifest = approvedManifest();
    expect(validateApprovalManifest(manifest)).toBe(manifest);

    const stale = { ...manifest, tag: "v0.0.1" };
    expect(() => validateApprovalManifest(stale)).toThrow(
      `approval manifest tag must be v${RELEASE_VERSION}`,
    );
    const changedArtifact = {
      ...manifest,
      browserArtifacts: manifest.browserArtifacts.map((artifact, index) =>
        index === 0 ? { ...artifact, sha256: "c".repeat(64) } : artifact,
      ),
    };
    expect(() => validateApprovalManifest(changedArtifact)).toThrow(
      "approval manifest candidate fingerprint is invalid or stale",
    );
  });
});

describe("registry consumer gate argument allowlist", () => {
  test("admits the npm flags, specifiers and consumer paths the gate execs", () => {
    const consumerRoot = path.resolve("registry-gate", "consumer");
    const permitted = [
      ...publicRegistryArgs([
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ]),
      `@libreconsent/core@${RELEASE_VERSION}`,
      "--moduleResolution=NodeNext",
      path.join(consumerRoot, "node_modules", "typescript", "bin", "tsc"),
      path.join(consumerRoot, "node_modules", "vite", "bin", "vite.js"),
      "root-imports.ts",
      "runtime.mjs",
      // Windows consumer roots keep their backslashes and drive letter.
      "C:\\Users\\runner\\AppData\\Local\\Temp\\gate\\consumer\\runtime.mjs",
    ];
    expect(() => assertSafeArguments("npm", permitted)).not.toThrow();
  });

  test("refuses whitespace, shell metacharacters and control characters", () => {
    const refused = [
      ["", "an empty token"],
      ["install --registry https://registry.npmjs.org/", "embedded whitespace"],
      ["/tmp/gate /consumer", "a path with a space"],
      ["install;id", "a semicolon"],
      ["install&&id", "a logical and"],
      ["install||id", "a logical or"],
      ["install|id", "a pipe"],
      ["install\nid", "a newline"],
      ["install\rid", "a carriage return"],
      ["install\tid", "a tab"],
      ["$(id)", "command substitution"],
      ["`id`", "backtick substitution"],
      ["$HOME", "parameter expansion"],
      ["install>/tmp/pwned", "output redirection"],
      ["install</etc/passwd", "input redirection"],
      ["consumer'quote", "a single quote"],
      ['consumer"quote', "a double quote"],
      ["--registry=https://registry.npmjs.org/%0a", "percent-encoded newline"],
      ["café", "non-ASCII text"],
      ["install\u0000", "a NUL byte"],
      ["/tmp/gate;touch pwned", "an injection suffix on a path"],
    ];
    for (const [token, description] of refused) {
      expect(
        () => assertSafeArguments("npm", [token]),
        `expected the allowlist to refuse ${description}`,
      ).toThrow(
        "refusing to exec npm with an argument outside the gate's safe token set",
      );
    }
  });

  test("refuses a non-string argument and names it in the error", () => {
    for (const token of [undefined, null, 42, ["install"], { toString: 1 }]) {
      expect(() => assertSafeArguments("node", [token])).toThrow(
        "refusing to exec node with an argument outside the gate's safe token set",
      );
    }
    expect(() => assertSafeArguments("npm", ["install", "x;y"])).toThrow(
      'refusing to exec npm with an argument outside the gate\'s safe token set: "x;y"',
    );
  });

  test("routes the registry install through the pinned npm interpreter", () => {
    // The two contracts meet here: the argv the gate really builds must pass
    // the allowlist, and its interpreter must be the literal cmd.exe.
    const invocation = npmInvocation(
      publicRegistryArgs([
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ]),
      { platform: "win32" },
    );
    expect(invocation.command).toBe("cmd.exe");
    expect(invocation.args.slice(0, 4)).toEqual(["/d", "/s", "/c", "npm"]);
    expect(() => assertSafeArguments("cmd.exe", invocation.args)).not.toThrow();
  });

  test("keeps a single exec sink and guards it before the child starts", () => {
    const source = readFileSync(
      path.join(scriptDirectory, "registry-consumer-gate.mjs"),
      "utf8",
    );
    // A second exec site would be a way around the allowlist.
    expect(source.match(/execFileSync\(/g) ?? []).toHaveLength(1);
    const runBody = source.slice(
      source.indexOf("function run("),
      source.indexOf("function runNpm("),
    );
    const guard = runBody.indexOf("assertSafeArguments(command, args);");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(runBody.indexOf("execFileSync("));
  });
});
