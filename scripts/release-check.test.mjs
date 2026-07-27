// SPDX-License-Identifier: MIT
import { describe, expect, test } from "vitest";
import { npmInvocation } from "./npm-invocation.mjs";
import { validateManifest, validateTarballFiles } from "./release-check.mjs";

const releasePackage = {
  directory: "packages/example",
  files: ["LICENSE", "README.md", "dist/index.js", "package.json"],
  name: "@libreconsent/example",
};

function validManifest() {
  return {
    name: releasePackage.name,
    version: "1.0.0",
    description: "Example",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/nicolasestrem/libreconsent.git",
      directory: releasePackage.directory,
    },
    homepage: "https://github.com/nicolasestrem/libreconsent#readme",
    bugs: {
      url: "https://github.com/nicolasestrem/libreconsent/issues",
    },
    keywords: ["consent", "privacy", "example"],
    publishConfig: { access: "public" },
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    scripts: { prepack: "pnpm run build" },
  };
}

describe("release package audit", () => {
  test("selects a portable npm invocation", () => {
    expect(
      npmInvocation(["pack", "--json"], {
        platform: "win32",
        comSpec: "C:\\Windows\\System32\\cmd.exe",
      }),
    ).toEqual({
      args: ["/d", "/s", "/c", "npm", "pack", "--json"],
      command: "C:\\Windows\\System32\\cmd.exe",
    });
    expect(
      npmInvocation(["pack", "--json"], {
        platform: "linux",
      }),
    ).toEqual({
      args: ["pack", "--json"],
      command: "npm",
    });
  });

  test("accepts complete public-package metadata", () => {
    expect(validateManifest(validManifest(), releasePackage)).toEqual([]);
  });

  test("rejects private, deep-exported, dependency-bearing packages", () => {
    const manifest = {
      ...validManifest(),
      private: true,
      dependencies: { copyleft: "1.0.0" },
      exports: {
        ".": validManifest().exports["."],
        "./internal": "./dist/internal.js",
      },
    };

    expect(validateManifest(manifest, releasePackage)).toEqual(
      expect.arrayContaining([
        "public package must not declare private",
        "only the package-root export may be public",
        "runtime dependencies are not allowed in the v1 packages",
      ]),
    );
  });

  test("requires the tarball allowlist to match exactly", () => {
    expect(
      validateTarballFiles(releasePackage.files, releasePackage.files),
    ).toEqual([]);
    expect(
      validateTarballFiles(
        [...releasePackage.files, "src/secret.ts"],
        releasePackage.files,
      ),
    ).toEqual([expect.stringContaining("src/secret.ts")]);
  });
});
