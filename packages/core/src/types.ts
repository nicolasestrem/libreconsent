// SPDX-License-Identifier: MIT
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
 * One pattern in the best-effort dynamic-injection safety net (BLK-4).
 *
 * A dynamically inserted `<script>` whose `src` contains `pattern` is neutered
 * before it runs and re-offered under `category` (or `service`, when named).
 */
export interface BlocklistEntry {
  /**
   * Case-sensitive substring matched against a script's `src`.
   *
   * Not a regular expression: a plain substring is predictable, cannot
   * backtrack pathologically, and stays JSON-serializable.
   */
  pattern: string;
  /** Category that must be granted before a matching script may run. */
  category: string;
  /** Service that must be granted instead, when the pattern maps to one. */
  service?: string;
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
  /**
   * Patterns for the **best-effort** dynamic-injection safety net (BLK-4).
   *
   * A `MutationObserver` neuters matching `<script src>` nodes inserted by
   * other scripts while their category is denied. This is **not a guarantee**:
   * parser-inserted scripts are never observed in time, and a dynamically
   * inserted *inline* script executes synchronously on insertion, so no
   * observer can precede it. The guaranteed path is always BLK-1 markup.
   *
   * Omitted or empty means no observer is created at all.
   */
  blocklist?: BlocklistEntry[];
}

/**
 * US state privacy configuration (CFG-8).
 *
 * US state laws follow an opt-out model rather than the EEA opt-in model, so
 * enabling this block changes what an *undecided* visitor in a configured
 * region experiences: optional categories behave as granted until the visitor
 * opts out, and no consent banner is shown. EEA opt-in behavior is unaffected
 * outside those regions, so one configuration serves both audiences (US-3).
 */
export interface UsPrivacyConfig {
  /** Whether the US opt-out model applies in the configured regions. */
  enabled?: boolean;
  /**
   * Regions where the opt-out model applies. Defaults to `["US"]`.
   *
   * Matching is prefix-aware on the `-` separator, so `US` also covers
   * `US-CA`. An empty array is rejected: it would silently disable the module.
   */
  regions?: string[];
  /**
   * CSS selector for the site's "Do Not Sell or Share" link (US-2).
   *
   * Clicks on a matching element open the opt-out dialog. The selector is
   * bound by `@libreconsent/ui`; the core never touches the DOM.
   */
  doNotSellSelector?: string;
  /**
   * Whether a `navigator.globalPrivacyControl` signal auto-applies the opt-out
   * for visitors in the configured regions. Defaults to `true` (US-1).
   */
  respectGPC?: boolean;
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
  /**
   * Complete optional consent-receipt target (LOG-4).
   *
   * Relative and absolute HTTP(S) URLs are accepted. The core posts only
   * explicit decisions, never appends a path, never retries, and never lets a
   * delivery failure affect consent behavior.
   */
  receiptEndpoint?: string;
  /** Consent Mode settings reserved for Phase 2 signaling. */
  consentMode?: ConsentModeConfig;
  /** First-party persistence settings. */
  storage?: StorageConfig;
  /** Declarative script and embed blocking settings. */
  blocking?: BlockingConfig;
  /** US state privacy opt-out settings. */
  usPrivacy?: UsPrivacyConfig;
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
  /** Best-effort dynamic-injection patterns. Empty means no observer. */
  blocklist: BlocklistEntry[];
}

/**
 * Fully defaulted and deeply frozen US privacy configuration.
 */
export interface NormalizedUsPrivacyConfig {
  /** Whether the US opt-out model applies in the configured regions. */
  enabled: boolean;
  /** Uppercase regions where the opt-out model applies. Defaults to `["US"]`. */
  regions: string[];
  /** Selector for the site's "Do Not Sell or Share" link, when configured. */
  doNotSellSelector?: string;
  /** Whether Global Privacy Control auto-applies the opt-out. */
  respectGPC: boolean;
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
  /** Trimmed complete consent-receipt target, when configured. */
  receiptEndpoint?: string;
  /** Fully defaulted Consent Mode settings. */
  consentMode: NormalizedConsentModeConfig;
  /** Fully defaulted persistence settings. */
  storage: NormalizedStorageConfig;
  /** Fully defaulted blocking settings. */
  blocking: NormalizedBlockingConfig;
  /** Fully defaulted US privacy settings. */
  usPrivacy: NormalizedUsPrivacyConfig;
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
  /**
   * Whether Global Privacy Control produced this state (US-1).
   *
   * **Never persisted.** The signal is re-read on every page load, so storing
   * it would turn a browser signal into a stored "decision" the visitor never
   * made, and would keep applying after the visitor disabled the signal.
   * An explicit decision taken afterwards clears the flag.
   */
  gpcApplied?: boolean;
  /**
   * Whether the US opt-out model synthesized this state rather than a visitor
   * deciding (US-3).
   *
   * **Never persisted**, because nothing may be stored before a decision
   * (CORE-8). It marks a state that is active — gated scripts run and Consent
   * Mode is signaled — while the visitor still has an opt-out outstanding.
   */
  implied?: boolean;
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
  /**
   * Active consent, or null while undecided.
   *
   * Non-null for a restored decision and for the state the US opt-out model
   * implies (`consent.implied === true`), which can pair with any `reason`
   * because `reason` describes what was found in storage, not what is active.
   * A renderer showing a banner should branch on this field, not on `reason`:
   * a non-null value means no decision is being asked for.
   */
  consent: ConsentState | null;
  /**
   * Resolved uppercase region, or null when unresolved or unconfigured.
   *
   * Renderers need this before a decision exists to hide services whose
   * `onlyRegions` exclude the visitor: the core forces such services to denied,
   * so offering a toggle for them would misrepresent the outcome.
   */
  region: string | null;
  /** Sanitized prior choices available only for a revision re-prompt. */
  prefill?: ConsentPrefill;
}

/**
 * Events emitted by the core lifecycle.
 */
export interface ConsentEvents {
  /** Emitted once after asynchronous initialization finishes. */
  ready: ReadyEvent;
  /**
   * Emitted for the first active state: a restored decision, a state implied
   * by the US opt-out model, or the first active user decision.
   */
  consent: ConsentState;
  /** Emitted for later decisions, including withdrawal. */
  change: ConsentState;
}

/**
 * A DOM renderer that fulfils the core's preferences intents.
 *
 * `@libreconsent/ui` registers one at mount time. The core never renders and
 * never requires a renderer: without one the intents stay inert no-ops.
 */
export interface ConsentRenderer {
  /** Opens the preferences layer. */
  showPreferences(): void;
  /** Hides any visible consent surface. */
  hide(): void;
  /**
   * Opens the "Do Not Sell or Share" opt-out dialog (US-2).
   *
   * Optional so renderers written before the US module still satisfy the
   * interface; the intent stays inert when a renderer does not implement it.
   */
  showOptOut?(): void;
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
  /** Forwards a preferences intent to the registered renderer, if any. */
  showPreferences(): void;
  /** Forwards a hide intent to the registered renderer, if any. */
  hide(): void;
  /**
   * Forwards a "Do Not Sell or Share" intent to the registered renderer, if
   * any. Site links are usually bound through `usPrivacy.doNotSellSelector`;
   * this is the programmatic equivalent for applications that route their own
   * clicks.
   */
  showOptOut(): void;
  /**
   * Registers the renderer that fulfils `showPreferences()` / `hide()` and
   * returns an unregister function. A later registration replaces the previous
   * renderer; `reset()` clears it.
   */
  registerRenderer(renderer: ConsentRenderer): () => void;
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
