import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  checkTraceabilityFile,
  validateTraceability,
} from "./check-traceability.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const fixturesDirectory = path.join(
  scriptDirectory,
  "fixtures",
  "traceability",
);

describe("phase-aware traceability", () => {
  test("accepts a complete valid fixture", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const result = checkTraceabilityFile(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      fixtureDirectory,
    );

    expect(result).toEqual({
      errors: [],
      latestCompletedPhase: 0,
      requiredCount: 5,
    });
  });

  test("rejects existing non-test files even when a runnable test is also cited", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const validMarkdown = readFileSync(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      "utf8",
    );
    const result = validateTraceability(
      validMarkdown.replace(
        "`packages/core/src/verification.test.ts`",
        "`README.md`; `packages/core/src/verification.test.ts`",
      ),
      fixtureDirectory,
    );

    expect(result.errors).toContain(
      "Line 7: test file(s) contains evidence that is not a configured Vitest/Playwright test file: README.md.",
    );
  });

  test("rejects CI evidence that does not name a supported CI check", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const validMarkdown = readFileSync(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      "utf8",
    );
    const result = validateTraceability(
      validMarkdown.replace(
        "`packages/core/src/verification.test.ts`",
        "`.github/workflows/ci.yml` — `Install dependencies`",
      ),
      fixtureDirectory,
    );

    expect(result.errors).toContain(
      "Line 7: .github/workflows/ci.yml verification evidence must name a supported CI check.",
    );
  });

  test("reports duplicate, empty, malformed, failing, missing, and nonexistent entries", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "broken");
    const result = checkTraceabilityFile(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      fixtureDirectory,
    );

    expect(result.errors).toEqual([
      "Line 9: implementation file(s) cannot be empty.",
      "Line 10: implementation file(s) references a nonexistent file: missing.ts.",
      "Line 11: traceability rows must contain exactly four cells.",
      "Requirement TOOL-1 has 2 rows; expected exactly one.",
      'Requirement TOOL-3 must have status "Passing" for completed phase 0.',
      "Requirement TOOL-4 is missing for completed phase 0.",
      "Requirement TOOL-5 is missing for completed phase 0.",
    ]);
  });

  test("requires exactly one supported completed-phase marker", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const validMarkdown = readFileSync(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      "utf8",
    );

    expect(
      validateTraceability(
        validMarkdown.replace("Latest completed phase: 0", ""),
        fixtureDirectory,
      ).errors,
    ).toContain(
      'Expected exactly one "Latest completed phase" marker, found 0.',
    );

    expect(
      validateTraceability(
        `${validMarkdown}\nLatest completed phase: 0\n`,
        fixtureDirectory,
      ).errors,
    ).toContain(
      'Expected exactly one "Latest completed phase" marker, found 2.',
    );

    expect(
      validateTraceability(
        validMarkdown.replace(
          "Latest completed phase: 0",
          "Latest completed phase: 10",
        ),
        fixtureDirectory,
      ).errors,
    ).toContain("Latest completed phase must be an integer from 0 through 9.");
  });

  test("rejects a malformed Markdown table separator", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const validMarkdown = readFileSync(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      "utf8",
    );
    const result = validateTraceability(
      validMarkdown.replace("|---|---|---|---|", "| Requirement rows begin |"),
      fixtureDirectory,
    );

    expect(result.errors).toContain(
      "Line 6: traceability table separator is missing or malformed.",
    );
  });

  test("validates the repository traceability document", () => {
    const result = checkTraceabilityFile(
      path.join(repositoryRoot, "specs", "TRACEABILITY.md"),
      repositoryRoot,
    );

    expect(result.errors).toEqual([]);
    expect(result.latestCompletedPhase).toBe(5);
  });
});
