// SPDX-License-Identifier: MIT
import { execFileSync } from "node:child_process";
import path from "node:path";
import { npmInvocation } from "./npm-invocation.mjs";
import {
  RELEASE_VERSION,
  releasePackages,
  repositoryRoot,
  sorted,
} from "./release-config.mjs";

function parseTrailingJson(output, packageName) {
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (character !== "[" && character !== "{") {
      continue;
    }
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // Lifecycle scripts may write progress before npm's final JSON payload.
    }
  }
  throw new Error(`${packageName}: npm publish output was not JSON`);
}

for (const releasePackage of releasePackages) {
  const packageRoot = path.join(repositoryRoot, releasePackage.directory);
  const invocation = npmInvocation([
    "publish",
    "--dry-run",
    "--access",
    "public",
    "--json",
  ]);
  const output = execFileSync(invocation.command, invocation.args, {
    cwd: packageRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parsed = parseTrailingJson(output, releasePackage.name);
  const result = parsed[releasePackage.name] ?? parsed;
  const actualFiles = Array.isArray(result.files)
    ? sorted(result.files.map((file) => file.path))
    : [];
  if (
    result.name !== releasePackage.name ||
    result.version !== RELEASE_VERSION ||
    actualFiles.join("\n") !== sorted(releasePackage.files).join("\n") ||
    result.files.some(
      (file) =>
        typeof file.path !== "string" ||
        !Number.isSafeInteger(file.size) ||
        file.size <= 0,
    )
  ) {
    throw new Error(
      `${releasePackage.name}: npm publish dry-run JSON was incomplete or inconsistent`,
    );
  }
  console.log(
    `${releasePackage.name}@${RELEASE_VERSION}: npm publish dry-run validated (${result.files.length} files).`,
  );
}
