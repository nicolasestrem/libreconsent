import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);

/**
 * Only the browser-side packages are scanned. `packages/worker-log` is the
 * server side of the opt-in receipt log, where network access is the whole
 * point, so it is deliberately out of scope.
 */
const SCANNED_PACKAGES = ["core", "ui", "bridge"];

/**
 * Every construct the library must never contain, with the requirement that
 * bans it. `label` is the human-readable pattern name used by findings and by
 * {@link EXCEPTIONS}, so it is part of this file's contract.
 */
const PROHIBITED_PATTERNS = [
  // G-6 / NFR-4: no dynamic code execution, no markup injection sinks.
  { label: "eval(", requirement: "G-6", expression: /\beval\s*\(/g },
  {
    label: "new Function(",
    requirement: "G-6",
    expression: /new\s+Function\s*\(/g,
  },
  { label: ".innerHTML =", requirement: "G-6", expression: /\.innerHTML\s*=/g },
  { label: ".outerHTML =", requirement: "G-6", expression: /\.outerHTML\s*=/g },
  {
    label: "insertAdjacentHTML",
    requirement: "G-6",
    expression: /insertAdjacentHTML/g,
  },
  {
    label: "document.write",
    requirement: "G-6",
    expression: /document\.write/g,
  },

  // NFR-2 / NFR-3: the library itself never originates a network request, so
  // it cannot phone home and cannot leak a visitor's decision anywhere.
  { label: "fetch(", requirement: "NFR-3", expression: /\bfetch\s*\(/g },
  {
    label: "XMLHttpRequest",
    requirement: "NFR-3",
    expression: /\bXMLHttpRequest\b/g,
  },
  { label: "sendBeacon", requirement: "NFR-3", expression: /sendBeacon/g },
  {
    label: "new WebSocket",
    requirement: "NFR-3",
    expression: /new\s+WebSocket/g,
  },
  {
    label: "new EventSource",
    requirement: "NFR-3",
    expression: /new\s+EventSource/g,
  },
  {
    label: "importScripts",
    requirement: "NFR-3",
    expression: /importScripts/g,
  },

  // G-1: reading a third-party `__tcfapi` in packages/bridge stays legal;
  // becoming a TCF provider (assigning it) never does.
  { label: "__tcfapi =", requirement: "G-1", expression: /__tcfapi\s*=/g },
  {
    label: "window.__tcfapi =",
    requirement: "G-1",
    expression: /\bwindow\.__tcfapi\s*=/g,
  },
];

/**
 * The reviewed escape hatch: a finding is ignored only when an entry matches
 * both its repository-relative `file` (forward slashes) and its `pattern`
 * label. Every entry needs a `reason` a reviewer signed off on, and the
 * "every exception still matches a real finding" test deletes the incentive to
 * leave stale waivers behind.
 *
 * It is empty today because nothing in core/ui/bridge needs a waiver. The
 * intended first entry is LOG-4's opt-in `receiptEndpoint` fetch when Phase 8
 * lands — a site owner has to configure that endpoint, so it is not telemetry.
 *
 * @type {{ file: string, pattern: string, reason: string }[]}
 */
// biome-ignore lint/suspicious/noExportsInTest: the waiver list is part of this guardrail's reviewed contract, so it is deliberately readable from outside the suite.
export const EXCEPTIONS = [];

const STRING_TERMINATORS = { single: "'", double: '"', template: "`" };

/**
 * Blanks out `/* ... *␣/` blocks and `// ...` line comments while preserving
 * every newline, so reported line numbers stay accurate and TSDoc prose that
 * names a banned construct cannot produce a false positive.
 *
 * String and template literals are tracked and left intact, because blanking
 * real code would produce false negatives. Two hazards are handled explicitly:
 * a `//` preceded by `:` is a URL scheme separator rather than a comment
 * start, and an unterminated single/double quote (an apostrophe the scanner
 * mistook for a quote) is reset at the newline that ends its line.
 *
 * @param {string} source Contents of a TypeScript source file.
 * @returns {string} The source with comment characters replaced by spaces.
 */
function stripComments(source) {
  let output = "";
  let index = 0;
  let state = "code";

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === "code") {
      if (character === "/" && nextCharacter === "*") {
        state = "block";
        output += "  ";
        index += 2;
        continue;
      }

      if (
        character === "/" &&
        nextCharacter === "/" &&
        source[index - 1] !== ":"
      ) {
        state = "line";
        output += "  ";
        index += 2;
        continue;
      }

      if (character === "'") {
        state = "single";
      } else if (character === '"') {
        state = "double";
      } else if (character === "`") {
        state = "template";
      }

      output += character;
      index += 1;
      continue;
    }

    if (state === "line") {
      if (character === "\n") {
        state = "code";
        output += character;
      } else {
        output += " ";
      }

      index += 1;
      continue;
    }

    if (state === "block") {
      if (character === "*" && nextCharacter === "/") {
        state = "code";
        output += "  ";
        index += 2;
        continue;
      }

      output += character === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }

    output += character;

    if (character === "\\") {
      output += nextCharacter ?? "";
      index += 2;
      continue;
    }

    if (character === STRING_TERMINATORS[state]) {
      state = "code";
    } else if (character === "\n" && state !== "template") {
      state = "code";
    }

    index += 1;
  }

  return output;
}

/**
 * @param {string} source Comment-stripped source text.
 * @param {number} index Character offset of a match.
 * @returns {number} The 1-based line number containing that offset.
 */
function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") {
      line += 1;
    }
  }

  return line;
}

/**
 * Scans one file's source for every prohibited construct. Pure, so the scanner
 * itself is provable against a synthetic violation without touching the disk.
 * {@link EXCEPTIONS} is intentionally *not* applied here — filtering is the
 * caller's job so that a waiver can be checked against the raw findings.
 *
 * @param {string} source Contents of a TypeScript source file.
 * @param {string} file Repository-relative path, forward slashes.
 * @returns {{ file: string, line: number, pattern: string, requirement: string, description: string }[]}
 */
function findViolations(source, file) {
  const stripped = stripComments(source);
  const findings = [];

  for (const { label, requirement, expression } of PROHIBITED_PATTERNS) {
    for (const match of stripped.matchAll(expression)) {
      const line = lineNumberAt(stripped, match.index);
      findings.push({
        file,
        line,
        pattern: label,
        requirement,
        description: `${file}:${line}: ${label}`,
      });
    }
  }

  return findings.sort((left, right) =>
    left.description.localeCompare(right.description),
  );
}

/**
 * Walks `packages/{core,ui,bridge}/src` for TypeScript sources, skipping
 * `*.test.ts` (tests legitimately build markup with `innerHTML`). Source is
 * scanned rather than `dist/` because CI runs unit tests before the build.
 *
 * @returns {string[]} Repository-relative paths, forward slashes, sorted.
 */
function collectSourceFiles() {
  const files = [];

  for (const packageName of SCANNED_PACKAGES) {
    const sourceDirectory = path.join(
      repositoryRoot,
      "packages",
      packageName,
      "src",
    );

    for (const entry of readdirSync(sourceDirectory, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith(".ts") ||
        entry.name.endsWith(".test.ts")
      ) {
        continue;
      }

      const absolutePath = path.join(
        entry.parentPath ?? entry.path,
        entry.name,
      );
      files.push(
        path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
      );
    }
  }

  return files.sort();
}

const sourceFiles = collectSourceFiles();
const allFindings = sourceFiles.flatMap((file) =>
  findViolations(readFileSync(path.join(repositoryRoot, file), "utf8"), file),
);

const isExcepted = (finding) =>
  EXCEPTIONS.some(
    (exception) =>
      exception.file === finding.file && exception.pattern === finding.pattern,
  );

describe("library guardrails", () => {
  test("core, ui, and bridge sources contain no prohibited construct", () => {
    expect(
      allFindings
        .filter((finding) => !isExcepted(finding))
        .map((finding) => finding.description),
    ).toEqual([]);
  });

  test("core, ui, and bridge declare zero runtime dependencies", () => {
    for (const packageName of SCANNED_PACKAGES) {
      const manifestPath = path.join(
        repositoryRoot,
        "packages",
        packageName,
        "package.json",
      );
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

      expect(
        Object.keys(manifest.dependencies ?? {}),
        `${packageName} runtime dependencies (G-2)`,
      ).toEqual([]);
      expect(
        Object.keys(manifest.peerDependencies ?? {}),
        `${packageName} peer dependencies (G-2)`,
      ).toEqual([]);

      for (const hook of ["preinstall", "install", "postinstall"]) {
        expect(
          manifest.scripts?.[hook],
          `${packageName} must not define a ${hook} script (NFR-3)`,
        ).toBeUndefined();
      }
    }
  });

  test("every exception still matches a real finding", () => {
    for (const exception of EXCEPTIONS) {
      const matched = allFindings.some(
        (finding) =>
          finding.file === exception.file &&
          finding.pattern === exception.pattern,
      );

      expect(
        matched,
        `stale exception: ${exception.file} no longer contains ${exception.pattern}`,
      ).toBe(true);
    }
  });

  test("the scan actually inspects a meaningful number of files", () => {
    expect(sourceFiles.length).toBeGreaterThanOrEqual(10);
    expect(sourceFiles).toContain("packages/core/src/index.ts");
    expect(sourceFiles).toContain("packages/ui/src/styles.ts");
    expect(sourceFiles.some((file) => file.endsWith(".test.ts"))).toBe(false);
  });

  test("the scanner detects a violation and ignores commented prose", () => {
    expect(
      findViolations(
        'const value = eval("1 + 1");\n',
        "packages/core/src/synthetic.ts",
      ).map((finding) => finding.description),
    ).toEqual(["packages/core/src/synthetic.ts:1: eval("]);

    expect(
      findViolations(
        [
          "/** Never call fetch( here. */",
          "// document.write is also banned.",
          'const endpoint = "https://example.test//path";',
          "target.textContent = source.innerHTML;",
        ].join("\n"),
        "packages/core/src/synthetic.ts",
      ),
    ).toEqual([]);

    expect(
      findViolations(
        'const endpoint = "https://example.test"; fetch(endpoint);\n',
        "packages/core/src/synthetic.ts",
      ).map((finding) => finding.description),
    ).toEqual(["packages/core/src/synthetic.ts:1: fetch("]);
  });
});
