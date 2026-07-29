// SPDX-License-Identifier: MIT
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";

function randomPort() {
  return 43_000 + Math.floor(Math.random() * 1_000);
}

function startServer(port) {
  const child = spawn(
    process.execPath,
    ["scripts/serve-static-quickstarts.mjs"],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Static quickstart server did not start"));
    }, 5_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Serving static quickstarts")) {
        clearTimeout(timeout);
        resolve(child);
      }
    });
  });
}

async function stopServer(child) {
  child.kill();
  await once(child, "exit");
}

describe("ordinary static quickstart server", () => {
  test("serves only tracked files without aliases or API behavior", async () => {
    const port = randomPort();
    const server = await startServer(port);

    try {
      const baseUrl = `http://127.0.0.1:${port}`;
      const [quickstart, vendorAsset, legacyAlias, regionApi] =
        await Promise.all([
          fetch(`${baseUrl}/quickstarts/basic-consent-mode/`),
          fetch(`${baseUrl}/vendor/libreconsent/core/index.global.js`),
          fetch(`${baseUrl}/dist/core.global.js`),
          fetch(`${baseUrl}/api/region`),
        ]);

      expect(quickstart.status).toBe(200);
      expect(vendorAsset.status).toBe(200);
      expect(vendorAsset.headers.get("content-type")).toBe(
        "text/javascript; charset=utf-8",
      );
      expect(legacyAlias.status).toBe(404);
      expect(regionApi.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });
});
