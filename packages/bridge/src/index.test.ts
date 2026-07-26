import { expect, test } from "vitest";
import * as bridge from "./index";

test("the Phase 0 bridge entry point has no public exports", () => {
  expect(Object.keys(bridge)).toEqual([]);
});
