// SPDX-License-Identifier: MIT

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  candidateFingerprint,
  knownReleaseLimits,
  parseReleaseNotes,
  parseReleasePrepareArgs,
  renderApprovalManifest,
  validateExternalEmptyOutput,
} from "./release-prepare.mjs";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "libreconsent-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

describe("release preparation", () => {
  test("requires a full approved SHA and named output directory", () => {
    expect(
      parseReleasePrepareArgs([
        "--expected-sha",
        "0123456789abcdef0123456789abcdef01234567",
        "--output",
        "C:\\release-output",
      ]),
    ).toEqual({
      expectedSha: "0123456789abcdef0123456789abcdef01234567",
      output: "C:\\release-output",
    });
    expect(() => parseReleasePrepareArgs([])).toThrow(
      "--expected-sha must be a full 40-character commit SHA",
    );
    expect(() =>
      parseReleasePrepareArgs([
        "--expected-sha",
        "deadbeef",
        "--output",
        "C:\\out",
      ]),
    ).toThrow("--expected-sha must be a full 40-character commit SHA");
  });

  test("accepts only an existing empty directory outside the repository", () => {
    const sandbox = temporaryDirectory();
    const repository = path.join(sandbox, "repository");
    const output = path.join(sandbox, "release-output");
    mkdirSync(repository);
    mkdirSync(output);

    expect(validateExternalEmptyOutput(output, repository)).toBe(output);
    expect(() =>
      validateExternalEmptyOutput(path.join(repository, "inside"), repository),
    ).toThrow("--output directory must already exist and be empty");
    mkdirSync(path.join(repository, "inside"));
    expect(() =>
      validateExternalEmptyOutput(path.join(repository, "inside"), repository),
    ).toThrow("--output must be outside the repository");
    writeFileSync(path.join(output, "unexpected.txt"), "not empty");
    expect(() => validateExternalEmptyOutput(output, repository)).toThrow(
      "--output directory must be empty",
    );
  });

  test("rejects an output directory inside another Git worktree", () => {
    const sandbox = temporaryDirectory();
    const repository = path.join(sandbox, "repository");
    const otherWorktree = path.join(sandbox, "other-worktree");
    const output = path.join(otherWorktree, "release-output");
    mkdirSync(repository);
    mkdirSync(path.join(otherWorktree, ".git"), { recursive: true });
    mkdirSync(output);

    expect(() => validateExternalEmptyOutput(output, repository)).toThrow(
      "--output must be outside every Git worktree",
    );
  });

  test("moves non-empty release notes out of Unreleased before preparation", () => {
    const ready =
      "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-07-29\n\n### Added\n\n- Released.\n";
    expect(parseReleaseNotes(ready)).toEqual({
      date: "2026-07-29",
      notes: "### Added\n\n- Released.",
    });
    expect(() =>
      parseReleaseNotes("## [Unreleased]\n\n- Still pending\n"),
    ).toThrow("CHANGELOG.md [Unreleased] must be empty");
  });

  test("fingerprints approval content and renders the mandatory approval record", () => {
    const candidate = {
      artifactFreezeDate: "2026-07-29",
      commit: "0123456789abcdef0123456789abcdef01234567",
      knownLimits: knownReleaseLimits,
      packages: [
        {
          exports: { ".": { import: "./dist/index.js" } },
          filename: "libreconsent-core-1.0.0.tgz",
          files: ["LICENSE", "package.json"],
          integrity: "sha512-example",
          name: "@libreconsent/core",
          packedSize: 1,
          peerDependencies: {},
          sha256: "a".repeat(64),
          unpackedSize: 2,
          version: "1.0.0",
        },
      ],
      publicationOrder: ["@libreconsent/core"],
      releaseNotes: "### Added\n\n- Released.",
      tag: "v1.0.0",
      uiCorePeer: "^1.0.0",
    };
    const manifest = {
      ...candidate,
      browserArtifacts: [
        {
          destination: "examples/vendor/libreconsent/core/index.global.js",
          sha256: "b".repeat(64),
        },
      ],
      candidateFingerprint: candidateFingerprint(candidate),
    };
    const approval = renderApprovalManifest(manifest);

    expect(candidateFingerprint({ ...candidate, tag: "v1.0.1" })).not.toBe(
      manifest.candidateFingerprint,
    );
    expect(approval).toContain(manifest.commit);
    expect(approval).toContain("v1.0.0");
    expect(approval).toContain("@libreconsent/core");
    expect(approval).toContain(manifest.packages[0].sha256);
    expect(approval).toContain(knownReleaseLimits[0]);
    expect(approval).toContain("I explicitly approve tagging this SHA");
  });
});
