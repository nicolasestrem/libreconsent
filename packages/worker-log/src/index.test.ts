import { expect, test } from "vitest";
import * as workerLog from "./index";

test("the Phase 0 worker-log entry point has no public exports", () => {
  expect(Object.keys(workerLog)).toEqual([]);
});
