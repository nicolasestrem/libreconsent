import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const nodeOptions = [process.env.NODE_OPTIONS, "--no-experimental-webstorage"]
  .filter(Boolean)
  .join(" ");
const result = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], {
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
