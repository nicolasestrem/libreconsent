// SPDX-License-Identifier: MIT

/**
 * Maximum retention window accepted by the Worker configuration.
 */
export const MAX_RETENTION_DAYS = 3650;

/**
 * Return a scheduled time that is strictly beyond every valid retention
 * window accepted by the Worker configuration.
 *
 * @param {number} now Epoch milliseconds used as the test baseline.
 * @returns {number} Epoch milliseconds after the maximum retention window.
 */
export function remotePurgeTime(now) {
  return now + (MAX_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
}
