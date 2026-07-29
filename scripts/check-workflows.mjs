import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const workflowExtension = /\.ya?ml$/i;
const remoteActionReference = /^[^@\s]+@([0-9a-f]{40})$/i;
const localActionReference = /^\.\//;

function leadingSpaces(line) {
  return line.length - line.trimStart().length;
}

function stepIndentFor(lines, usesLine) {
  for (let index = usesLine; index >= 0; index -= 1) {
    if (/^\s*-\s+/.test(lines[index] ?? "")) {
      return leadingSpaces(lines[index] ?? "");
    }
  }

  return leadingSpaces(lines[usesLine] ?? "");
}

function checkoutDisablesCredentialPersistence(lines, usesLine) {
  const stepIndent = stepIndentFor(lines, usesLine);

  for (let index = usesLine + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*-\s+/.test(line) && leadingSpaces(line) === stepIndent) {
      break;
    }
    if (/^\s*persist-credentials\s*:\s*false\s*(?:#.*)?$/i.test(line)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates the remote-action and checkout-token policy for one workflow.
 *
 * @param {string} source Workflow YAML source.
 * @param {string} file Repository-relative workflow path.
 * @returns {string[]} Policy violations with file and line anchors.
 */
export function validateWorkflow(source, file) {
  const errors = [];
  const lines = source.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const uses = line.match(/^\s*(?:-\s*)?uses\s*:\s*([^\s#]+)(?:\s*#.*)?$/);
    if (!uses) continue;

    const reference = uses[1];
    const lineNumber = index + 1;
    if (
      !localActionReference.test(reference) &&
      !remoteActionReference.test(reference)
    ) {
      errors.push(
        `${file}:${lineNumber}: remote action must use a full 40-character commit SHA: ${reference}`,
      );
    }
    if (
      reference.toLowerCase().startsWith("actions/checkout@") &&
      !checkoutDisablesCredentialPersistence(lines, index)
    ) {
      errors.push(
        `${file}:${lineNumber}: actions/checkout must set persist-credentials: false`,
      );
    }
  }

  return errors;
}

/**
 * Recursively reads every GitHub Actions workflow with a YAML extension.
 *
 * @param {string} workflowsDirectory Absolute workflow directory path.
 * @param {string} rootDirectory Absolute repository or fixture root path.
 * @returns {{ file: string, source: string }[]} Sorted workflow source files.
 */
export function collectWorkflows(workflowsDirectory, rootDirectory) {
  const workflows = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && workflowExtension.test(entry.name)) {
        workflows.push({
          file: path.relative(rootDirectory, entryPath).replaceAll("\\", "/"),
          source: readFileSync(entryPath, "utf8"),
        });
      }
    }
  }

  visit(workflowsDirectory);
  return workflows.sort((left, right) => left.file.localeCompare(right.file));
}

/**
 * Validates every workflow in a repository or synthetic fixture directory.
 *
 * @param {string} rootDirectory Absolute root directory containing `.github/workflows`.
 * @returns {string[]} Sorted policy violations.
 */
export function validateWorkflowDirectory(rootDirectory) {
  const workflowsDirectory = path.join(rootDirectory, ".github", "workflows");
  return collectWorkflows(workflowsDirectory, rootDirectory)
    .flatMap(({ file, source }) => validateWorkflow(source, file))
    .sort();
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const errors = validateWorkflowDirectory(repositoryRoot);
  if (errors.length > 0) {
    console.error("Workflow guardrail check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    const workflowCount = collectWorkflows(
      path.join(repositoryRoot, ".github", "workflows"),
      repositoryRoot,
    ).length;
    console.log(
      `Workflow guardrail check passed: ${workflowCount} YAML workflow files use immutable remote actions and disable checkout credential persistence.`,
    );
  }
}
