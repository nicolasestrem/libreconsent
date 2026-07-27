// SPDX-License-Identifier: MIT

import { describe, expect, test } from "vitest";
import {
  MAX_RETENTION_DAYS,
  remotePurgeTime,
} from "./worker-log-remote-time.mjs";

describe("remote Worker purge time", () => {
  test("advances strictly beyond every valid retention window", () => {
    const now = Date.UTC(2026, 6, 28);
    const latestRetainedTime = now + MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    expect(remotePurgeTime(now)).toBeGreaterThan(latestRetainedTime);
  });
});
