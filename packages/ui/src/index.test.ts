import { expect, test } from "vitest";
import * as ui from "./index";

test("the Phase 0 UI entry point has no public exports", () => {
  expect(Object.keys(ui)).toEqual([]);
});
