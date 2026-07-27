import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";

function randomPort() {
  return 42_000 + Math.floor(Math.random() * 1_000);
}

function startServer(port, env = {}) {
  const child = spawn(process.execPath, ["scripts/serve-examples.mjs"], {
    env: {
      ...process.env,
      LIBRECONSENT_HEAD_SNIPPET_PATH:
        "packages/core/dist/missing-head-snippet.global.js",
      PORT: String(port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Example server did not start"));
    }, 5_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Serving example fixtures")) {
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

describe("example fixture server", () => {
  test("returns a clear 500 when the compiled head artifact is unavailable", async () => {
    const port = randomPort();
    const server = await startServer(port);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/basic-site/`);

      expect(response.status).toBe(500);
      await expect(response.text()).resolves.toBe(
        "Consent Mode head artifact is unavailable. Run pnpm build first.",
      );
    } finally {
      await stopServer(server);
    }
  });

  test("returns a clear 500 when the compiled core artifact is unavailable", async () => {
    const port = randomPort();
    const server = await startServer(port, {
      LIBRECONSENT_CORE_ARTIFACT_PATH:
        "packages/core/dist/missing-index.global.js",
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/dist/core.global.js`,
      );

      expect(response.status).toBe(500);
      await expect(response.text()).resolves.toBe(
        "Core browser artifact is unavailable. Run pnpm build first.",
      );
    } finally {
      await stopServer(server);
    }
  });

  test("returns a clear 500 when the compiled UI artifact is unavailable", async () => {
    const port = randomPort();
    const server = await startServer(port, {
      LIBRECONSENT_UI_ARTIFACT_PATH: "packages/ui/dist/missing-index.global.js",
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/dist/ui.global.js`,
      );

      expect(response.status).toBe(500);
      await expect(response.text()).resolves.toBe(
        "UI browser artifact is unavailable. Run pnpm build first.",
      );
    } finally {
      await stopServer(server);
    }
  });

  test("serves the compiled UI artifact as executable JavaScript", async () => {
    const port = randomPort();
    const server = await startServer(port, {
      LIBRECONSENT_UI_ARTIFACT_PATH: "scripts/serve-examples.mjs",
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/dist/ui.global.js`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/javascript; charset=utf-8",
      );
      await expect(response.text()).resolves.toContain(
        "Serving example fixtures",
      );
    } finally {
      await stopServer(server);
    }
  });

  test("serves the compiled core artifact as executable JavaScript", async () => {
    const port = randomPort();
    const server = await startServer(port, {
      LIBRECONSENT_CORE_ARTIFACT_PATH: "scripts/serve-examples.mjs",
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/dist/core.global.js`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/javascript; charset=utf-8",
      );
      await expect(response.text()).resolves.toContain(
        "Serving example fixtures",
      );
    } finally {
      await stopServer(server);
    }
  });
});
