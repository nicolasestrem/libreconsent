import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const range = (prefix, start, end) =>
  Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}-${start + index}`,
  );

/**
 * Requirement ownership follows the phase plan in
 * specs/03_MASTER_PRODUCTION_SPEC.md.
 */
export const PHASE_REQUIREMENTS = [
  range("TOOL", 1, 5),
  [...range("CFG", 1, 7), "CFG-9", ...range("CORE", 1, 11)],
  range("CM", 1, 6),
  [...range("BLK", 1, 3), "BLK-5"],
  range("UI", 1, 8),
  ["BLK-4", ...range("NFR", 1, 4)],
  ["CFG-8", ...range("US", 1, 4)],
  range("BR", 1, 4),
  range("LOG", 1, 4),
  range("NFR", 5, 6),
];

const KNOWN_REQUIREMENTS = new Set(PHASE_REQUIREMENTS.flat());
const REQUIREMENT_ID_PATTERN =
  /^(?:TOOL|CFG|CORE|CM|BLK|UI|NFR|US|BR|LOG)-\d+$/;
const FILE_REFERENCE_PATTERN =
  /^(?:\.github|examples|packages|scripts|specs|tests)\//;
const ROOT_FILE_PATTERN =
  /^[A-Za-z0-9_.-]+\.(?:c?js|css|html|json|md|mjs|mts|ts|tsx|ya?ml)$/;
const VITEST_TEST_FILE_PATTERN =
  /^(?:packages\/[^/]+\/src\/.+\.test\.ts|scripts\/.+\.test\.mjs)$/;
const PLAYWRIGHT_TEST_FILE_PATTERN = /^tests\/.+\.(?:e2e|a11y)\.spec\.ts$/;
const CI_WORKFLOW_REFERENCE = ".github/workflows/ci.yml";

function unquote(value) {
  const quoted = value.match(/^(['"])([\s\S]*)\1$/);
  return quoted?.[2] ?? value;
}

/**
 * Read the gate scripts chained by the workspace `check` script.
 *
 * @param {string} rootDirectory Directory containing the root `package.json`.
 * @returns {Set<string>} Script names such as `lint` and `release:check`.
 */
function gateScriptNames(rootDirectory) {
  const manifestPath = path.resolve(rootDirectory, "package.json");
  if (!existsSync(manifestPath)) {
    return new Set();
  }

  const check = JSON.parse(readFileSync(manifestPath, "utf8")).scripts?.check;
  return new Set(
    [...String(check ?? "").matchAll(/pnpm\s+([\w:-]+)/g)].map(
      (match) => match[1],
    ),
  );
}

/**
 * Collect the CI names a traceability row may cite as verification evidence.
 *
 * The names are derived from the workflow rather than hard-coded, so a row can
 * never cite a check that no longer runs and a renamed step fails the gate
 * instead of passing unverified. Only steps that run one of the workspace gate
 * scripts qualify: setup and teardown steps such as `Check out repository`,
 * `Install dependencies` and `Upload Playwright artifacts` prove nothing about
 * a requirement, so accepting them would let an implemented requirement claim
 * verification without a test.
 *
 * @param {string} rootDirectory Directory containing `.github/workflows`.
 * @returns {Set<string>} The job display name and every verifying step name.
 */
export function ciWorkflowCheckNames(rootDirectory) {
  const workflowPath = path.resolve(rootDirectory, CI_WORKFLOW_REFERENCE);
  if (!existsSync(workflowPath) || !statSync(workflowPath).isFile()) {
    return new Set();
  }

  const gateScripts = gateScriptNames(rootDirectory);
  const names = new Set();
  let pendingStep;

  for (const line of readFileSync(workflowPath, "utf8").split(/\r?\n/)) {
    const step = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (step?.[1] !== undefined) {
      pendingStep = unquote(step[1]);
      continue;
    }

    // A step qualifies only once its own `run:` names a gate script.
    const run = line.match(/^\s*run:\s*(.+?)\s*$/);
    if (run?.[1] !== undefined) {
      if (pendingStep !== undefined) {
        const invoked = unquote(run[1]).match(/^pnpm\s+([\w:-]+)/);
        if (invoked?.[1] !== undefined && gateScripts.has(invoked[1])) {
          names.add(pendingStep);
        }
        pendingStep = undefined;
      }
      continue;
    }

    const job = line.match(/^ {4}name:\s*(.+?)\s*$/);
    if (job?.[1] !== undefined) {
      names.add(unquote(job[1]));
    }
  }

  return names;
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function fileReferences(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]?.replaceAll("\\", "/"))
    .filter(
      (value) =>
        value !== undefined &&
        (FILE_REFERENCE_PATTERN.test(value) || ROOT_FILE_PATTERN.test(value)),
    );
}

function validateFileReferences(
  cell,
  label,
  lineNumber,
  rootDirectory,
  errors,
) {
  const references = fileReferences(cell);
  if (references.length === 0) {
    errors.push(
      `Line ${lineNumber}: ${label} must contain at least one backticked repository file path.`,
    );
    return;
  }

  for (const reference of references) {
    const resolved = path.resolve(rootDirectory, reference);
    const relative = path.relative(rootDirectory, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      errors.push(
        `Line ${lineNumber}: ${label} references a file outside the repository: ${reference}.`,
      );
      continue;
    }

    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      errors.push(
        `Line ${lineNumber}: ${label} references a nonexistent file: ${reference}.`,
      );
    }
  }
}

function isRunnableTestFile(reference) {
  return (
    VITEST_TEST_FILE_PATTERN.test(reference) ||
    PLAYWRIGHT_TEST_FILE_PATTERN.test(reference)
  );
}

function ciCheckNames(cell) {
  const ciReference = cell.match(
    /`\.github\/workflows\/ci\.yml`\s*—\s*((?:`[^`]+`(?:,\s*)?)+)/,
  );

  return [...(ciReference?.[1].matchAll(/`([^`]+)`/g) ?? [])].map(
    (match) => match[1],
  );
}

function validateVerificationReferences(
  cell,
  lineNumber,
  supportedCiChecks,
  errors,
) {
  const references = fileReferences(cell);
  const unsupportedReferences = references.filter(
    (reference) =>
      !isRunnableTestFile(reference) && reference !== CI_WORKFLOW_REFERENCE,
  );
  const citedCiChecks = ciCheckNames(cell);
  const unknownCiChecks = citedCiChecks.filter(
    (checkName) => !supportedCiChecks.has(checkName),
  );

  if (unsupportedReferences.length > 0) {
    errors.push(
      `Line ${lineNumber}: verification evidence cites files that are not Vitest or Playwright test files: ${unsupportedReferences.join(", ")}.`,
    );
  }

  if (
    references.includes(CI_WORKFLOW_REFERENCE) &&
    citedCiChecks.length === 0
  ) {
    errors.push(
      `Line ${lineNumber}: ${CI_WORKFLOW_REFERENCE} verification evidence must name at least one CI job or step.`,
    );
  }

  if (unknownCiChecks.length > 0) {
    errors.push(
      `Line ${lineNumber}: verification evidence cites CI checks that ${CI_WORKFLOW_REFERENCE} does not declare: ${unknownCiChecks.join(", ")}.`,
    );
  }
}

/**
 * Validate a traceability document against the completed phase marker.
 *
 * @param {string} markdown Traceability Markdown.
 * @param {string} rootDirectory Directory used to resolve referenced files.
 * @returns {{ errors: string[], latestCompletedPhase: number | null, requiredCount: number }}
 */
export function validateTraceability(markdown, rootDirectory) {
  const errors = [];
  const supportedCiChecks = ciWorkflowCheckNames(rootDirectory);
  const phaseMatches = [
    ...markdown.matchAll(/^Latest completed phase:\s*(\d+)\s*$/gim),
  ];
  let latestCompletedPhase = null;

  if (phaseMatches.length !== 1) {
    errors.push(
      `Expected exactly one "Latest completed phase" marker, found ${phaseMatches.length}.`,
    );
  } else {
    latestCompletedPhase = Number(phaseMatches[0]?.[1]);
    if (
      !Number.isInteger(latestCompletedPhase) ||
      latestCompletedPhase < 0 ||
      latestCompletedPhase >= PHASE_REQUIREMENTS.length
    ) {
      errors.push(
        `Latest completed phase must be an integer from 0 through ${PHASE_REQUIREMENTS.length - 1}.`,
      );
      latestCompletedPhase = null;
    }
  }

  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) =>
      line.trim() ===
      "| Requirement ID | Implementation file(s) | Test file(s) | Status |",
  );
  const rows = new Map();

  if (headerIndex === -1) {
    errors.push("Traceability table header is missing or malformed.");
  } else {
    const separatorIndex = headerIndex + 1;
    const separatorCells = splitTableRow(lines[separatorIndex] ?? "");
    const hasValidSeparator =
      separatorCells?.length === 4 &&
      separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell));
    if (!hasValidSeparator) {
      errors.push(
        `Line ${separatorIndex + 1}: traceability table separator is missing or malformed.`,
      );
    }

    const firstRowIndex = hasValidSeparator ? headerIndex + 2 : headerIndex + 1;
    for (let index = firstRowIndex; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || !line.trim().startsWith("|")) {
        break;
      }

      const lineNumber = index + 1;
      const cells = splitTableRow(line);
      if (cells === null || cells.length !== 4) {
        errors.push(
          `Line ${lineNumber}: traceability rows must contain exactly four cells.`,
        );
        continue;
      }

      const [requirementId, implementation, verification, status] = cells;
      if (
        requirementId === undefined ||
        !REQUIREMENT_ID_PATTERN.test(requirementId) ||
        !KNOWN_REQUIREMENTS.has(requirementId)
      ) {
        errors.push(
          `Line ${lineNumber}: unknown or malformed requirement ID "${requirementId ?? ""}".`,
        );
        continue;
      }

      const existing = rows.get(requirementId) ?? [];
      existing.push({ implementation, lineNumber, status, verification });
      rows.set(requirementId, existing);

      if (implementation === "") {
        errors.push(
          `Line ${lineNumber}: implementation file(s) cannot be empty.`,
        );
      } else {
        validateFileReferences(
          implementation,
          "implementation file(s)",
          lineNumber,
          rootDirectory,
          errors,
        );
      }

      if (verification === "") {
        errors.push(`Line ${lineNumber}: test file(s) cannot be empty.`);
      } else {
        validateFileReferences(
          verification,
          "test file(s)",
          lineNumber,
          rootDirectory,
          errors,
        );
        validateVerificationReferences(
          verification,
          lineNumber,
          supportedCiChecks,
          errors,
        );
      }

      if (status === "") {
        errors.push(`Line ${lineNumber}: status cannot be empty.`);
      }
    }
  }

  for (const [requirementId, matchingRows] of rows) {
    if (matchingRows.length > 1) {
      errors.push(
        `Requirement ${requirementId} has ${matchingRows.length} rows; expected exactly one.`,
      );
    }
  }

  const requiredRequirements =
    latestCompletedPhase === null
      ? []
      : PHASE_REQUIREMENTS.slice(0, latestCompletedPhase + 1).flat();

  for (const requirementId of requiredRequirements) {
    const matchingRows = rows.get(requirementId) ?? [];
    if (matchingRows.length === 0) {
      errors.push(
        `Requirement ${requirementId} is missing for completed phase ${latestCompletedPhase}.`,
      );
      continue;
    }

    if (matchingRows.length === 1 && matchingRows[0]?.status !== "Passing") {
      errors.push(
        `Requirement ${requirementId} must have status "Passing" for completed phase ${latestCompletedPhase}.`,
      );
    }
  }

  return {
    errors,
    latestCompletedPhase,
    requiredCount: requiredRequirements.length,
  };
}

/**
 * Read and validate a traceability file.
 *
 * @param {string} traceabilityPath Traceability Markdown path.
 * @param {string} rootDirectory Directory used to resolve referenced files.
 * @returns {{ errors: string[], latestCompletedPhase: number | null, requiredCount: number }}
 */
export function checkTraceabilityFile(traceabilityPath, rootDirectory) {
  return validateTraceability(
    readFileSync(traceabilityPath, "utf8"),
    rootDirectory,
  );
}

const scriptPath = fileURLToPath(import.meta.url);
if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === scriptPath
) {
  const repositoryRoot = path.dirname(path.dirname(scriptPath));
  const traceabilityPath = path.join(
    repositoryRoot,
    "specs",
    "TRACEABILITY.md",
  );
  const result = checkTraceabilityFile(traceabilityPath, repositoryRoot);

  if (result.errors.length > 0) {
    console.error("Traceability check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Traceability check passed through Phase ${result.latestCompletedPhase} (${result.requiredCount} requirements).`,
    );
  }
}
