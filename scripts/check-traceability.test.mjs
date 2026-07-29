import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  checkTraceabilityFile,
  ciWorkflowCheckNames,
  validateTraceability,
} from "./check-traceability.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const fixturesDirectory = path.join(
  scriptDirectory,
  "fixtures",
  "traceability",
);

/**
 * Build a single-phase table whose rows all carry the same verification cell,
 * resolved against the real repository so CI evidence is checked against the
 * workflow this repository actually runs. The first row is always line 7.
 */
function repositoryTable(verification) {
  return [
    "# Repository-rooted traceability fixture",
    "",
    "Latest completed phase: 0",
    "",
    "| Requirement ID | Implementation file(s) | Test file(s) | Status |",
    "|---|---|---|---|",
    ...["TOOL-1", "TOOL-2", "TOOL-3", "TOOL-4", "TOOL-5"].map(
      (requirementId) =>
        `| ${requirementId} | \`package.json\` | ${verification} | Passing |`,
    ),
    "",
  ].join("\n");
}

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
      "Line 7: verification evidence cites files that are not Vitest or Playwright test files: README.md.",
    );
  });

  test("rejects CI evidence that names no CI check at all", () => {
    const fixtureDirectory = path.join(fixturesDirectory, "valid");
    const validMarkdown = readFileSync(
      path.join(fixtureDirectory, "TRACEABILITY.md"),
      "utf8",
    );
    const result = validateTraceability(
      validMarkdown.replace(
        "`packages/core/src/verification.test.ts`",
        "`.github/workflows/ci.yml`",
      ),
      fixtureDirectory,
    );

    expect(result.errors).toContain(
      "Line 7: .github/workflows/ci.yml verification evidence must name at least one CI job or step.",
    );
  });

  test("rejects a CI check the workflow does not declare", () => {
    const result = validateTraceability(
      repositoryTable("`.github/workflows/ci.yml` — `Nonexistent gate`"),
      repositoryRoot,
    );

    expect(result.errors).toContain(
      "Line 7: verification evidence cites CI checks that .github/workflows/ci.yml does not declare: Nonexistent gate.",
    );
  });

  test("accepts every job and step the CI workflow declares", () => {
    const declared = [...ciWorkflowCheckNames(repositoryRoot)];

    expect(declared).toContain("All gates");
    expect(declared).toContain("Install dependencies");
    expect(declared).toContain("Static quickstart portability");
    expect(declared).not.toContain("Publication dry-runs");

    for (const checkName of declared) {
      expect(
        validateTraceability(
          repositoryTable(`\`.github/workflows/ci.yml\` — \`${checkName}\``),
          repositoryRoot,
        ).errors,
      ).toEqual([]);
    }
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
    expect(result.latestCompletedPhase).toBe(9);
    expect(result.requiredCount).toBe(62);
  });
});
