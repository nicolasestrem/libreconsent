// SPDX-License-Identifier: MIT
/**
 * Stable error codes exposed by libreconsent core.
 */
export type ConsentErrorCode = "INVALID_CONFIG" | "INVALID_SELECTION";

/**
 * Typed error with a machine-readable code and offending configuration/selection path.
 */
export class ConsentError extends Error {
  /** Stable error category. */
  readonly code: ConsentErrorCode;

  /** Path to the invalid value, such as `categories[1].id`. */
  readonly path: string;

  /**
   * Creates a typed libreconsent error.
   */
  constructor(code: ConsentErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ConsentError";
    this.code = code;
    this.path = path;
  }
}
