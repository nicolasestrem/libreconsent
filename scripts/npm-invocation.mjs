// SPDX-License-Identifier: MIT
import process from "node:process";

export function npmInvocation(
  args,
  {
    platform = process.platform,
    comSpec = process.env.ComSpec ?? "cmd.exe",
  } = {},
) {
  if (platform === "win32") {
    return {
      args: ["/d", "/s", "/c", "npm", ...args],
      command: comSpec,
    };
  }
  return { args, command: "npm" };
}
