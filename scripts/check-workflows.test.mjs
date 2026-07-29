import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  collectWorkflows,
  validateWorkflow,
  validateWorkflowDirectory,
} from "./check-workflows.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const fixtureRoot = path.join(scriptDirectory, "fixtures", "workflows");
const invalidFixtureRoot = path.join(fixtureRoot, "invalid");

function invalidFixtureSource(fixture) {
  return readFileSync(
    path.join(invalidFixtureRoot, ".github", "workflows", fixture),
    "utf8",
  );
}

describe("workflow supply-chain guardrails", () => {
  test("accepts immutable remote actions, version comments, local actions, and both YAML extensions", () => {
    expect(
      collectWorkflows(
        path.join(fixtureRoot, ".github", "workflows"),
        fixtureRoot,
      ).map(({ file }) => file),
    ).toEqual([
      ".github/workflows/local-action.yaml",
      ".github/workflows/pinned-comment.yml",
    ]);
    expect(validateWorkflowDirectory(fixtureRoot)).toEqual([]);
  });

  test.each([
    ["mutable-tag.yml", "actions/checkout@v4"],
    ["latest.yml", "anomalyco/opencode/github@latest"],
    ["branch.yaml", "actions/checkout@main"],
    ["semantic-version.yml", "anthropics/claude-code-action@v1.0.183"],
    ["short-sha.yaml", "actions/checkout@11d5960"],
  ])("rejects %s", (fixture, reference) => {
    expect(
      validateWorkflow(
        invalidFixtureSource(fixture),
        `.github/workflows/${fixture}`,
      ),
    ).toEqual([
      `.github/workflows/${fixture}:4: remote action must use a full 40-character commit SHA: ${reference}`,
    ]);
  });

  test("rejects flow-style step mappings with action references", () => {
    expect(
      validateWorkflow(
        invalidFixtureSource("flow-mapping.yml"),
        ".github/workflows/flow-mapping.yml",
      ),
    ).toEqual([
      ".github/workflows/flow-mapping.yml:4: flow-style step mappings with uses are not allowed; use block YAML",
    ]);
  });

  test("rejects a checkout that does not disable credential persistence", () => {
    expect(
      validateWorkflow(
        invalidFixtureSource("missing-credentials.yml"),
        ".github/workflows/missing-credentials.yml",
      ),
    ).toEqual([
      ".github/workflows/missing-credentials.yml:4: actions/checkout must set persist-credentials: false",
    ]);
  });

  test("rejects a credential setting nested outside checkout inputs", () => {
    expect(
      validateWorkflow(
        invalidFixtureSource("nested-credentials.yml"),
        ".github/workflows/nested-credentials.yml",
      ),
    ).toEqual([
      ".github/workflows/nested-credentials.yml:4: actions/checkout must set persist-credentials: false",
    ]);
  });

  test("validates the repository workflows", () => {
    expect(validateWorkflowDirectory(repositoryRoot)).toEqual([]);
  });
});
