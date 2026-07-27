import type { ConsentState } from "./types";

/** Actions accepted by the optional receipt service (LOG-2). */
export type ReceiptAction = "consent" | "change" | "withdraw";

/**
 * Delivers one explicit decision to the configured receipt target (LOG-4).
 *
 * This boundary is intentionally best-effort: serialization, location access,
 * synchronous fetch failures, and promise rejections are all isolated. There
 * are no retries, and the caller never awaits delivery.
 */
export function deliverReceipt(
  endpoint: string,
  state: ConsentState,
  action: ReceiptAction,
): void {
  try {
    const payload = {
      consentId: state.consentId,
      host: location.host,
      revision: state.revision,
      categories: { ...state.categories },
      ts: state.updatedAt,
      action,
    };
    const delivery = fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    void Promise.resolve(delivery).catch(() => undefined);
  } catch {
    // Receipt delivery is optional and must never affect the consent lifecycle.
  }
}
