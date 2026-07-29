// SPDX-License-Identifier: MIT

import path from "node:path";
import { describe, expect, test } from "vitest";
import { quickstartAssetPaths } from "./quickstart-assets.mjs";
import {
  parseRegistryConsumerArgs,
  publicRegistryArgs,
  validateApprovalManifest,
} from "./registry-consumer-gate.mjs";
import { releasePackages } from "./release-config.mjs";
import { candidateFingerprint } from "./release-prepare.mjs";

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
      version: "1.0.0",
    })),
    publicationOrder: releasePackages.map(
      (releasePackage) => releasePackage.name,
    ),
    releaseNotes: "### Added\n\n- Released.",
    tag: "v1.0.0",
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
    ).toThrow("--approval must name an absolute release-manifest.json path");
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

    const stale = { ...manifest, tag: "v1.0.1" };
    expect(() => validateApprovalManifest(stale)).toThrow(
      "approval manifest tag must be v1.0.0",
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
