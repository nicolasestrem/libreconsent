/**
 * A translatable cookie-disclosure row attached to a service.
 */
export interface CookieTableRow {
  /** Cookie or storage key name. */
  name: string;
  /** Translation key describing why the cookie is used. */
  purpose: string;
  /** Translation key naming the provider. */
  provider?: string;
  /** Translation key describing the retention period. */
  duration?: string;
  /** Translation key describing the storage type. */
  type?: string;
}

/**
 * A consent-controlled service nested under a category.
 */
export interface ServiceConfig {
  /** Globally unique stable service identifier. */
  id: string;
  /** Translation key for the service label. */
  label: string;
  /** Cookie disclosure rows shown for this service. */
  cookies?: CookieTableRow[];
  /** Upper- or lower-case ISO-like region codes where the service may be enabled. */
  onlyRegions?: string[];
}

/**
 * A consent category and its services.
 */
export interface CategoryConfig {
  /** Stable category identifier. */
  id: string;
  /** Translation key for the category label. */
  label: string;
  /** Translation key for the category description. */
  description: string;
  /** Whether the configured value is immutable through the public API. */
  readonly?: boolean;
  /** Initial value for a readonly category. Optional categories must not start enabled. */
  enabled?: boolean;
  /** Services controlled by this category. */
  services?: ServiceConfig[];
}

/**
 * Google Consent Mode v2 signal names accepted by the configuration.
 */
export type GoogleSignal =
  | "analytics_storage"
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization";

/**
 * Consent Mode regional default behavior.
 */
export type ConsentModeDefaults =
  | "denied-everywhere"
  | {
      deniedRegions: string[];
    };

/**
 * Consent Mode configuration normalized now and applied in Phase 2.
 */
export interface ConsentModeConfig {
  /** Whether Consent Mode integration is enabled. */
  enabled?: boolean;
  /** Maps each Google signal to a libreconsent category ID. */
  mapping?: Partial<Record<GoogleSignal, string>>;
  /** Global or regional denied-default strategy. */
  defaults?: ConsentModeDefaults;
  /** Milliseconds Google tags may wait for a consent update. */
  waitForUpdate?: number;
  /** Whether ad data redaction should be requested when ad storage is denied. */
  adsDataRedaction?: boolean;
  /** Whether URL passthrough should be requested. */
  urlPassthrough?: boolean;
}

declare global {
  interface Window {
    /** Stable head-bootstrap configuration reused by `init()`. */
    libreconsentConsentMode?: ConsentModeConfig;
  }
}

/**
 * Declarative script and embed blocking configuration.
 *
 * Blocking itself is opted into by markup: a page with no `data-cmp-category`
 * elements never needs this object. The options here only tune how the
 * guaranteed path (BLK-1) behaves once gated elements exist.
 */
export interface BlockingConfig {
  /**
   * CSP nonce applied to re-created scripts that carry no nonce of their own.
   * An element's own nonce always wins over this value.
   */
  nonce?: string;
  /**
   * Whether revoking consent for an already-executed script reloads the page.
   * Scripts cannot be un-executed, so this is the only way to undo their effects.
   */
  reloadOnWithdraw?: boolean;
}

/**
 * First-party consent storage configuration.
 */
export interface StorageConfig {
  /** Cookie and localStorage key. */
  cookieName?: string;
  /** Optional cookie domain. */
  domain?: string;
  /** Decision lifetime in days, up to 395. */
  expiresDays?: number;
  /** Cookie SameSite attribute. */
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * A locale dictionary keyed by stable translation keys.
 */
export type Dictionary = Record<string, string>;

/**
 * Translation configuration.
 */
export interface I18nConfig {
  /** Default locale used for required keys and fallbacks. */
  default?: string;
  /** Whether a later UI phase may use the browser language. */
  autoDetect?: boolean;
  /** Per-locale dictionaries. Secondary locales may be partial. */
  translations?: Record<string, Dictionary>;
}

/**
 * Public initialization configuration for libreconsent core.
 */
export interface CmpConfig {
  /** Ordered consent categories. `necessary` is injected when absent. */
  categories: CategoryConfig[];
  /** Consent Mode settings reserved for Phase 2 signaling. */
  consentMode?: ConsentModeConfig;
  /** First-party persistence settings. */
  storage?: StorageConfig;
  /** Declarative script and embed blocking settings. */
  blocking?: BlockingConfig;
  /** Schema revision. A higher value invalidates older active decisions. */
  revision?: number;
  /** Translation dictionaries and locale behavior. */
  i18n?: I18nConfig;
  /** Optional asynchronous region resolver. No network request is built in. */
  resolveRegion?: () => Promise<string | null>;
}

/**
 * Fully defaulted and deeply frozen Consent Mode configuration.
 */
export interface NormalizedConsentModeConfig {
  /** Whether Consent Mode integration is enabled. */
  enabled: boolean;
  /** Complete Google signal-to-category mapping. */
  mapping: Record<GoogleSignal, string>;
  /** Normalized global or uppercase regional default strategy. */
  defaults: ConsentModeDefaults;
  /** Milliseconds Google tags may wait for a consent update. */
  waitForUpdate: number;
  /** Whether ad data redaction is configured. */
  adsDataRedaction: boolean;
  /** Whether URL passthrough is configured. */
  urlPassthrough: boolean;
}

/**
 * Fully defaulted and deeply frozen storage configuration.
 */
export interface NormalizedStorageConfig {
  /** Cookie and localStorage key. */
  cookieName: string;
  /** Optional cookie domain. */
  domain?: string;
  /** Decision lifetime in days. */
  expiresDays: number;
  /** Cookie SameSite attribute. */
  sameSite: "Strict" | "Lax" | "None";
}

/**
 * Fully defaulted and deeply frozen blocking configuration.
 */
export interface NormalizedBlockingConfig {
  /** Fallback CSP nonce for re-created scripts, when configured. */
  nonce?: string;
  /** Whether revoking an executed script's category reloads the page. */
  reloadOnWithdraw: boolean;
}

/**
 * Fully normalized category configuration.
 */
export interface NormalizedCategoryConfig {
  /** Stable category identifier. */
  id: string;
  /** Translation key for the category label. */
  label: string;
  /** Translation key for the category description. */
  description: string;
  /** Whether the configured value is immutable. */
  readonly: boolean;
  /** Configured immutable/default value. */
  enabled: boolean;
  /** Normalized service list. */
  services: NormalizedServiceConfig[];
}

/**
 * Fully normalized service configuration.
 */
export interface NormalizedServiceConfig {
  /** Globally unique stable service identifier. */
  id: string;
  /** Translation key for the service label. */
  label: string;
  /** Normalized cookie disclosure rows. */
  cookies: CookieTableRow[];
  /** Uppercase regions where this service may be enabled. */
  onlyRegions: string[];
}

/**
 * Deeply frozen effective configuration returned by `getConfig()`.
 */
export interface NormalizedCmpConfig {
  /** Ordered categories with `necessary` first. */
  categories: NormalizedCategoryConfig[];
  /** Fully defaulted Consent Mode settings. */
  consentMode: NormalizedConsentModeConfig;
  /** Fully defaulted persistence settings. */
  storage: NormalizedStorageConfig;
  /** Fully defaulted blocking settings. */
  blocking: NormalizedBlockingConfig;
  /** Positive schema revision. */
  revision: number;
  /** Fully merged locale dictionaries. */
  i18n: {
    /** Default locale. */
    default: string;
    /** Whether browser-language detection is configured. */
    autoDetect: boolean;
    /** Dictionaries with default-locale fallbacks applied. */
    translations: Record<string, Dictionary>;
  };
  /** Original region resolver identity, when configured. */
  resolveRegion?: () => Promise<string | null>;
}

/**
 * Persisted active consent state.
 */
export interface ConsentState {
  /** UUIDv4 identifying one decision lifecycle. */
  consentId: string;
  /** UTC ISO-8601 timestamp for the first decision in the lifecycle. */
  createdAt: string;
  /** UTC ISO-8601 timestamp for the latest decision. */
  updatedAt: string;
  /** Configuration revision used by the decision. */
  revision: number;
  /** Effective category choices. */
  categories: Record<string, boolean>;
  /** Effective service choices. */
  services: Record<string, boolean>;
  /** Resolved uppercase region, when available. */
  region?: string;
  /** Whether a future US module applied Global Privacy Control. */
  gpcApplied?: boolean;
}

/**
 * Partial user selection accepted by `setConsent`.
 */
export interface ConsentSelection {
  /** Category changes, applied before explicit service changes. */
  categories?: Record<string, boolean>;
  /** Service changes that override category-derived service values. */
  services?: Record<string, boolean>;
}

/**
 * Sanitized inactive choices exposed for revision re-prompt prefilling.
 */
export interface ConsentPrefill {
  /** Known category choices after current invariants are applied. */
  categories: Record<string, boolean>;
  /** Known service choices after current invariants are applied. */
  services: Record<string, boolean>;
}

/**
 * Initialization outcome used by the replayable `ready` event.
 */
export type InitializationReason = "new" | "restored" | "expired" | "revision";

/**
 * Replayable initialization event payload.
 */
export interface ReadyEvent {
  /** Why initialization requires or does not require a new decision. */
  reason: InitializationReason;
  /** Active restored consent, or null while undecided. */
  consent: ConsentState | null;
  /** Sanitized prior choices available only for a revision re-prompt. */
  prefill?: ConsentPrefill;
}

/**
 * Events emitted by the core lifecycle.
 */
export interface ConsentEvents {
  /** Emitted once after asynchronous initialization finishes. */
  ready: ReadyEvent;
  /** Emitted for a restored state or the first active user decision. */
  consent: ConsentState;
  /** Emitted for later decisions, including withdrawal. */
  change: ConsentState;
}

/**
 * Public core lifecycle API.
 */
export interface ConsentApi {
  /** Returns the active consent state, or null while undecided or initializing. */
  getConsent(): ConsentState | null;
  /** Accepts every applicable non-readonly service/category. */
  acceptAll(): void;
  /** Denies every non-readonly service/category. */
  rejectAll(): void;
  /** Applies category changes, then explicit service overrides. */
  setConsent(selection: ConsentSelection): void;
  /** Persists an all-denied optional state and emits `change` for active consent. */
  withdraw(): void;
  /** Emits a DOM-safe preferences intent reserved for the UI package. */
  showPreferences(): void;
  /** Emits a DOM-safe hide intent reserved for the UI package. */
  hide(): void;
  /** Subscribes to an event and returns an unsubscribe function. */
  on<K extends keyof ConsentEvents>(
    event: K,
    callback: (payload: ConsentEvents[K]) => void,
  ): () => void;
  /** Removes an event callback. */
  off<K extends keyof ConsentEvents>(
    event: K,
    callback: (payload: ConsentEvents[K]) => void,
  ): void;
  /** Returns the deeply frozen normalized configuration. */
  getConfig(): NormalizedCmpConfig;
  /** Test hook that invalidates initialization, listeners, state, and storage. */
  reset(): void;
}
