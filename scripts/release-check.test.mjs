// SPDX-License-Identifier: MIT
import { describe, expect, test } from "vitest";
import { npmInvocation } from "./npm-invocation.mjs";
import {
  validateEmbeddedHeadSnippet,
  validateManifest,
  validateQuickstartAssetReferences,
  validateQuickstartAssetWorkflow,
  validateQuickstartVendorAssets,
  validateTarballFiles,
} from "./release-check.mjs";

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

  test("requires the declared peer dependency contract exactly", () => {
    const uiPackage = {
      ...releasePackage,
      name: "@libreconsent/ui",
      peerDependencies: {
        "@libreconsent/core": "^1.0.0",
      },
    };

    expect(
      validateManifest(
        {
          ...validManifest(),
          name: uiPackage.name,
        },
        uiPackage,
      ),
    ).toContain("peerDependencies must match the release contract exactly");
    expect(
      validateManifest(
        {
          ...validManifest(),
          name: uiPackage.name,
          peerDependencies: {
            "@libreconsent/core": "^2.0.0",
          },
        },
        uiPackage,
      ),
    ).toContain("peerDependencies must match the release contract exactly");
    expect(
      validateManifest(
        {
          ...validManifest(),
          name: uiPackage.name,
          peerDependencies: {
            "@libreconsent/core": "^1.0.0",
          },
        },
        uiPackage,
      ),
    ).toEqual([]);
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

  test("requires copyable quickstarts to inline the packaged head snippet", () => {
    const artifact =
      "window.gtag = function () {};\n//# sourceMappingURL=head.js.map";
    const validHtml = `<script>
window.libreconsentConsentMode = { enabled: true };
</script>
<script data-libreconsent-head-artifact>
window.gtag = function () {};
</script>`;

    expect(validateEmbeddedHeadSnippet(validHtml, artifact)).toEqual([]);
    expect(
      validateEmbeddedHeadSnippet(
        validHtml.replace(
          "window.gtag = function () {};",
          "window.gtag = undefined;",
        ),
        artifact,
      ),
    ).toContain("inline head snippet differs from the packaged artifact");
    expect(
      validateEmbeddedHeadSnippet(
        validHtml.replace(
          /<script data-libreconsent-head-artifact>[\s\S]*?<\/script>/,
          "<!-- LIBRECONSENT_HEAD_SNIPPET -->",
        ),
        artifact,
      ),
    ).toEqual(
      expect.arrayContaining([
        "repository-only head-snippet placeholder remains",
        "complete inline head snippet is missing",
      ]),
    );
  });

  test("requires exact vendored browser assets and relative quickstart paths", () => {
    const sourcePath = "packages/core/dist/index.global.js";
    const destinationPath = "examples/vendor/libreconsent/core/index.global.js";
    const files = new Map([
      [sourcePath, Buffer.from("built browser asset")],
      [destinationPath, Buffer.from("built browser asset")],
    ]);
    const readBuffer = (filePath) => {
      const content = files.get(filePath);
      if (!content) throw new Error("missing");
      return content;
    };
    const assets = [
      {
        destination: destinationPath,
        destinationPath,
        source: sourcePath,
        sourcePath,
      },
    ];

    expect(validateQuickstartVendorAssets(assets, readBuffer)).toEqual([]);
    files.set(destinationPath, Buffer.from("stale browser asset"));
    expect(validateQuickstartVendorAssets(assets, readBuffer)).toEqual([
      `${destinationPath}: differs from byte-identical built asset ${sourcePath}`,
    ]);
    files.delete(destinationPath);
    expect(validateQuickstartVendorAssets(assets, readBuffer)).toEqual([
      `${destinationPath}: tracked browser asset is missing`,
    ]);
    expect(
      validateQuickstartAssetReferences(
        '<script src="../../vendor/libreconsent/core/index.global.js"></script>',
      ),
    ).toEqual([]);
    expect(
      validateQuickstartAssetReferences(
        '<script src="/dist/core.global.js"></script><script src="/quickstarts/basic-consent-mode/analytics.js"></script><script src="/vendor/libreconsent/core/index.global.js"></script>',
      ),
    ).toEqual([
      "root-absolute local quickstart asset reference remains: /dist/core.global.js",
      "root-absolute local quickstart asset reference remains: /quickstarts/basic-consent-mode/analytics.js",
      "root-absolute local quickstart asset reference remains: /vendor/libreconsent/core/index.global.js",
    ]);
    expect(
      validateQuickstartAssetWorkflow({
        scripts: { build: "pnpm -r --if-present build" },
      }),
    ).toEqual([]);
    expect(
      validateQuickstartAssetWorkflow({
        scripts: { build: "pnpm build && pnpm quickstarts:sync-assets" },
      }),
    ).toEqual(["package build must not synchronize tracked quickstart assets"]);
  });
});
