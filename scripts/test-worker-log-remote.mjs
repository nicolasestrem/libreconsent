import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { remotePurgeTime } from "./worker-log-remote-time.mjs";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(
  process.env.LIBRECONSENT_WORKER_LOG_CONFIG ??
    "packages/worker-log/wrangler.test-account.jsonc",
);
const workerUrl = process.env.LIBRECONSENT_WORKER_LOG_URL;
const allowedOrigin = process.env.LIBRECONSENT_WORKER_LOG_ORIGIN;
const bearerToken = process.env.LIBRECONSENT_WORKER_LOG_TOKEN;
const port = Number(process.env.LIBRECONSENT_WORKER_LOG_PORT ?? "8791");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const databaseBinding = "DB";

if (!existsSync(configPath)) {
  throw new Error(
    `Missing untracked test-account config at ${configPath}. See packages/worker-log/README.md.`,
  );
}
if (!workerUrl || !allowedOrigin || !bearerToken) {
  throw new Error(
    "Set LIBRECONSENT_WORKER_LOG_URL, LIBRECONSENT_WORKER_LOG_ORIGIN, and LIBRECONSENT_WORKER_LOG_TOKEN.",
  );
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("LIBRECONSENT_WORKER_LOG_PORT must be an available port.");
}

function runWrangler(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `Wrangler exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`,
        ),
      );
    });
  });
}

async function expectJson(response, status) {
  const text = await response.text();
  if (response.status !== status) {
    throw new Error(
      `Expected HTTP ${status}, received ${response.status}: ${text}`,
    );
  }
  return JSON.parse(text);
}

async function waitForRemoteDev(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
  }
  throw new Error("Wrangler remote development server did not become ready.");
}

await runWrangler([
  "d1",
  "migrations",
  "apply",
  databaseBinding,
  "--remote",
  "--config",
  configPath,
]);
await runWrangler(["deploy", "--config", configPath]);

const consentId = crypto.randomUUID();
const postedAt = new Date().toISOString();
const receipt = {
  consentId,
  host: new URL(allowedOrigin).host,
  revision: 1,
  categories: { necessary: true, analytics: false, marketing: false },
  ts: postedAt,
  action: "consent",
};
const postResult = await expectJson(
  await fetch(new URL("/receipt", workerUrl), {
    method: "POST",
    headers: {
      origin: allowedOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify(receipt),
  }),
  201,
);
console.log("POST /receipt", JSON.stringify(postResult));

const retrievalUrl = new URL(
  `/receipts/${encodeURIComponent(consentId)}`,
  workerUrl,
);
const beforePurge = await expectJson(
  await fetch(retrievalUrl, {
    headers: { authorization: `Bearer ${bearerToken}` },
  }),
  200,
);
if (beforePurge.receipts?.length !== 1) {
  throw new Error(
    `Expected one stored receipt, received ${JSON.stringify(beforePurge)}`,
  );
}
console.log("GET before purge", JSON.stringify(beforePurge));

const dev = spawn(
  process.execPath,
  [
    wrangler,
    "dev",
    "--test-scheduled",
    "--config",
    configPath,
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  },
);

try {
  const localUrl = `http://127.0.0.1:${port}`;
  await waitForRemoteDev(localUrl);
  const futureTime = remotePurgeTime(Date.now());
  const scheduledUrl = new URL("/cdn-cgi/handler/scheduled", localUrl);
  scheduledUrl.searchParams.set("cron", "0 0 * * *");
  scheduledUrl.searchParams.set("time", String(futureTime));
  const scheduledResponse = await fetch(scheduledUrl);
  const scheduledBody = await scheduledResponse.text();
  if (!scheduledResponse.ok) {
    throw new Error(
      `Scheduled handler failed with HTTP ${scheduledResponse.status}: ${scheduledBody}`,
    );
  }
  console.log(
    "Scheduled purge",
    JSON.stringify({
      status: scheduledResponse.status,
      time: futureTime,
      body: scheduledBody,
    }),
  );
} finally {
  if (dev.exitCode === null) {
    dev.kill();
    await new Promise((resolvePromise) => dev.once("exit", resolvePromise));
  }
}

const afterPurge = await expectJson(
  await fetch(retrievalUrl, {
    headers: { authorization: `Bearer ${bearerToken}` },
  }),
  200,
);
if (afterPurge.receipts?.length !== 0) {
  throw new Error(
    `Expected the receipt to be purged, received ${JSON.stringify(afterPurge)}`,
  );
}
console.log("GET after purge", JSON.stringify(afterPurge));
console.log("Remote Worker receipt round-trip and scheduled purge passed.");
