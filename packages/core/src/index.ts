import { normalizeConfig, sameConfig } from "./config";
import { ConsentError } from "./errors";
import { ConsentLifecycle } from "./lifecycle";
import type { CmpConfig, ConsentApi } from "./types";

let singleton: ConsentLifecycle | null = null;

/**
 * Initializes the libreconsent core lifecycle.
 *
 * Configuration validation is synchronous. Region resolution and storage restoration
 * finish asynchronously and are observable through the replayable `ready` event.
 */
export function init(config: CmpConfig): ConsentApi {
  const normalized = normalizeConfig(config);
  if (singleton) {
    if (!sameConfig(singleton.getConfig(), normalized)) {
      throw new ConsentError(
        "INVALID_CONFIG",
        "config",
        "init() was already called with a materially different configuration",
      );
    }
    return singleton;
  }

  singleton = new ConsentLifecycle(normalized, (released) => {
    if (singleton === released) {
      singleton = null;
    }
  });
  return singleton;
}

export { en, fr } from "./dictionaries";
export type { ConsentErrorCode } from "./errors";
export { ConsentError } from "./errors";
export type {
  BlockingConfig,
  CategoryConfig,
  CmpConfig,
  ConsentApi,
  ConsentEvents,
  ConsentModeConfig,
  ConsentModeDefaults,
  ConsentPrefill,
  ConsentRenderer,
  ConsentSelection,
  ConsentState,
  CookieTableRow,
  Dictionary,
  GoogleSignal,
  I18nConfig,
  InitializationReason,
  NormalizedBlockingConfig,
  NormalizedCategoryConfig,
  NormalizedCmpConfig,
  NormalizedConsentModeConfig,
  NormalizedServiceConfig,
  NormalizedStorageConfig,
  NormalizedUsPrivacyConfig,
  ReadyEvent,
  ServiceConfig,
  StorageConfig,
  UsPrivacyConfig,
} from "./types";
