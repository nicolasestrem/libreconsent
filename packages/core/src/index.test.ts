import { expect, test } from "vitest";
import * as core from "./index";

test("the Phase 0 core entry point has no public exports", () => {
  expect(Object.keys(core)).toEqual([]);
});
