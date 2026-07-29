// SPDX-License-Identifier: MIT

/**
 * Raised when an operator invoked a script incorrectly: an unknown flag, a
 * path that does not meet the documented contract, or a worktree that is not
 * in the required state. These are reported as readable text rather than as a
 * Node stack trace, which is reserved for genuine gate failures and defects.
 */
export class UsageError extends Error {
  /** @param {string} message Single-sentence description of the mistake. */
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * Throw a {@link UsageError}.
 *
 * @param {string} message Single-sentence description of the mistake.
 * @returns {never}
 */
export function failUsage(message) {
  throw new UsageError(message);
}

/**
 * Report a {@link UsageError} as a header, a bulleted cause, and a usage line,
 * then mark the process as failed. Anything else is rethrown unchanged so real
 * failures keep their stack trace.
 *
 * @param {unknown} error Error caught around a script's entry point.
 * @param {string} header Sentence naming what could not be done.
 * @param {string} usage Invocation line showing the accepted arguments.
 * @returns {void}
 */
export function reportUsageError(error, header, usage) {
  if (!(error instanceof UsageError)) {
    throw error;
  }
  console.error(header);
  console.error(`- ${error.message}`);
  console.error(usage);
  process.exitCode = 1;
}
