// SPDX-License-Identifier: MIT
import process from "node:process";

export function npmInvocation(
  args,
  { platform = process.platform, comSpec = "cmd.exe" } = {},
) {
  // The Windows shell is pinned to the system default rather than read from
  // the environment: `ComSpec` is attacker-influenceable configuration, and
  // the program that interprets npm's argv must never be chosen by it.
  // Callers that genuinely need a different shell pass it explicitly.
  if (platform === "win32") {
    return {
      args: ["/d", "/s", "/c", "npm", ...args],
      command: comSpec,
    };
  }
  return { args, command: "npm" };
}
