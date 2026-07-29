// SPDX-License-Identifier: MIT
import type {
  ConsentApi,
  ConsentState,
  GoogleSignal,
  NormalizedConsentModeConfig,
} from "./types";

type ConsentModeValue = "denied" | "granted";

type GoogleConsentUpdate = Record<GoogleSignal, ConsentModeValue>;

interface GoogleWindow {
  gtag?: (...args: unknown[]) => void;
}

const SIGNALS: GoogleSignal[] = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
];

function updateFor(
  state: ConsentState,
  config: NormalizedConsentModeConfig,
): GoogleConsentUpdate {
  return Object.fromEntries(
    SIGNALS.map((signal) => [
      signal,
      typeof config.mapping[signal] === "string" &&
      state.categories[config.mapping[signal]] === true
        ? "granted"
        : "denied",
    ]),
  ) as GoogleConsentUpdate;
}

function sendUpdate(
  state: ConsentState,
  config: NormalizedConsentModeConfig,
): void {
  try {
    const googleWindow = window as GoogleWindow;
    if (typeof googleWindow.gtag === "function") {
      googleWindow.gtag("consent", "update", updateFor(state, config));
    }
  } catch {
    // Consent persistence and lifecycle delivery must survive third-party failures.
  }
}

/**
 * Subscribes one Consent Mode sender to core consent lifecycle events.
 *
 * `consent` is replayable, so restored decisions are signaled without a separate
 * initialization path. `change` covers all later decisions and withdrawal.
 */
export class ConsentModeAdapter {
  private readonly unsubscribe: (() => void)[] = [];

  constructor(api: ConsentApi, config: NormalizedConsentModeConfig) {
    if (!config.enabled) {
      return;
    }
    const update = (state: ConsentState): void => sendUpdate(state, config);
    this.unsubscribe.push(api.on("consent", update), api.on("change", update));
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe.splice(0)) {
      unsubscribe();
    }
  }
}
