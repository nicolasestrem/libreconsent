/**
 * Determines how TCF purpose grants become one libreconsent category grant.
 */
export interface PurposeMapping {
  /** TCF purpose IDs inspected for this category. */
  purposes: readonly number[];
  /** Whether every purpose or at least one purpose must be granted. */
  match: "all" | "any";
}

/**
 * A core-compatible consent shape accepted from an injected fallback.
 *
 * The bridge intentionally reads only categories and services. Identifiers,
 * revisions, timestamps, and other core-only metadata never become fabricated
 * bridge state.
 */
export interface BridgeFallbackConsentState {
  /** Effective fallback category choices. */
  categories: Record<string, boolean>;
  /** Effective fallback service choices. */
  services: Record<string, boolean>;
}

/**
 * The part of a fallback `ready` payload the bridge consumes.
 */
export interface BridgeFallbackReadyEvent {
  /** Active fallback consent, or null while the fallback awaits a decision. */
  consent: BridgeFallbackConsentState | null;
}

/**
 * Read and event surface required from a dependency-free fallback factory.
 *
 * `@libreconsent/core`'s `ConsentApi` satisfies this structure, but the bridge
 * does not import or bundle core. Write methods remain owned by the returned
 * core API and are deliberately not exposed through `BridgeApi`.
 */
export interface BridgeFallbackApi {
  /** Returns the fallback's active consent state. */
  getConsent(): BridgeFallbackConsentState | null;
  /** Subscribes to a core-compatible lifecycle event. */
  on(
    event: "ready",
    callback: (payload: BridgeFallbackReadyEvent) => void,
  ): () => void;
  /** Subscribes to a core-compatible consent event. */
  on(
    event: "consent" | "change",
    callback: (payload: BridgeFallbackConsentState) => void,
  ): () => void;
  /** Removes a core-compatible lifecycle event callback. */
  off(
    event: "ready",
    callback: (payload: BridgeFallbackReadyEvent) => void,
  ): void;
  /** Removes a core-compatible consent event callback. */
  off(
    event: "consent" | "change",
    callback: (payload: BridgeFallbackConsentState) => void,
  ): void;
}

/**
 * Public bridge initialization configuration.
 */
export interface BridgeConfig {
  /** Positive integer CMP discovery deadline in milliseconds. Defaults to 3000. */
  timeoutMs?: number;
  /**
   * Complete replacement for `DEFAULT_PURPOSE_MAPPING`.
   *
   * `necessary` is always granted and cannot be configured here.
   */
  purposeMapping?: Record<string, PurposeMapping>;
  /**
   * Creates a full libreconsent API only after CMP discovery times out.
   *
   * The bridge proxies its read/events surface and never calls its destructive
   * `reset()`. The host still owns the full API returned by this factory.
   */
  fallback?: () => BridgeFallbackApi;
}

/**
 * A truthful consent observation exposed by the read-only bridge.
 */
export interface BridgeConsentState {
  /** System that supplied this observation. */
  source: "tcf" | "fallback";
  /** Effective libreconsent category choices. */
  categories: Record<string, boolean>;
  /** Fallback service choices, or an empty record for purpose-only TCF data. */
  services: Record<string, boolean>;
  /** CMP GDPR applicability, or null for a non-TCF fallback. */
  gdprApplies: boolean | null;
  /** UTC time at which this material state was observed. */
  observedAt: string;
}

/**
 * Replayable bridge initialization payload.
 */
export interface BridgeReadyEvent {
  /** Discovery outcome or active fallback source. */
  source: "tcf" | "none" | "fallback";
  /** Consent available at initialization, or null while undecided. */
  consent: BridgeConsentState | null;
}

/**
 * Events emitted by the bridge.
 */
export interface BridgeEvents {
  /** Emitted once after a source is established or discovery times out. */
  ready: BridgeReadyEvent;
  /** Emitted for the first usable consent observation. */
  consent: BridgeConsentState;
  /** Emitted for later material consent changes. */
  change: BridgeConsentState;
}

/**
 * Read-only bridge API.
 */
export interface BridgeApi {
  /** Returns the latest observed consent, or null when none is active. */
  getConsent(): BridgeConsentState | null;
  /** Subscribes to an event and returns an unsubscribe function. */
  on<K extends keyof BridgeEvents>(
    event: K,
    callback: (payload: BridgeEvents[K]) => void,
  ): () => void;
  /** Removes an event callback. */
  off<K extends keyof BridgeEvents>(
    event: K,
    callback: (payload: BridgeEvents[K]) => void,
  ): void;
  /**
   * Tears down bridge observation and releases the singleton.
   *
   * This never resets or otherwise writes through to an injected fallback.
   */
  reset(): void;
}

interface NormalizedBridgeConfig {
  timeoutMs: number;
  purposeMapping: Readonly<Record<string, PurposeMapping>>;
  fallback?: () => BridgeFallbackApi;
}

interface TcfData {
  eventStatus?: unknown;
  gdprApplies?: unknown;
  listenerId?: unknown;
  purpose?: {
    consents?: unknown;
  };
}

type TcfCallback = (data: TcfData, success: boolean) => void;
type TcfApi = (
  command: "addEventListener" | "removeEventListener",
  version: 2,
  callback: TcfCallback | ((success: boolean) => void),
  parameter?: number,
) => void;

declare global {
  interface Window {
    /** External CMP API observed by the read-only bridge. */
    __tcfapi?: TcfApi;
  }
}

const DEFAULT_MAPPING_DATA: Record<string, PurposeMapping> = {
  analytics: { purposes: [1, 7, 8, 9, 10], match: "all" },
  marketing: { purposes: [1, 2, 3, 4], match: "all" },
};

function freezeMapping(
  mapping: Record<string, PurposeMapping>,
): Readonly<Record<string, PurposeMapping>> {
  for (const value of Object.values(mapping)) {
    Object.freeze(value.purposes);
    Object.freeze(value);
  }
  return Object.freeze(mapping);
}

/**
 * Strict, deeply frozen category mapping shipped with the bridge.
 */
export const DEFAULT_PURPOSE_MAPPING = freezeMapping(DEFAULT_MAPPING_DATA);

function invalid(path: string, detail: string): never {
  throw new TypeError(`Invalid bridge config at ${path}: ${detail}`);
}

function normalizeConfig(config: BridgeConfig): NormalizedBridgeConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    invalid("config", "expected an object");
  }

  const timeoutMs = config.timeoutMs ?? 3000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    invalid("timeoutMs", "expected a positive integer");
  }
  if (config.fallback !== undefined && typeof config.fallback !== "function") {
    invalid("fallback", "expected a function");
  }

  const source = config.purposeMapping ?? DEFAULT_PURPOSE_MAPPING;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    invalid("purposeMapping", "expected an object");
  }

  const normalized: Record<string, PurposeMapping> = Object.create(null);
  for (const [rawId, value] of Object.entries(source)) {
    const id = rawId.trim();
    if (!id) {
      invalid("purposeMapping", "category IDs must not be empty");
    }
    if (id === "necessary") {
      invalid("purposeMapping.necessary", "necessary cannot be remapped");
    }
    if (id !== rawId) {
      invalid(
        `purposeMapping.${rawId}`,
        "category IDs must not contain padding",
      );
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      invalid(`purposeMapping.${id}`, "expected an object");
    }
    if (value.match !== "all" && value.match !== "any") {
      invalid(`purposeMapping.${id}.match`, 'expected "all" or "any"');
    }
    if (!Array.isArray(value.purposes) || value.purposes.length === 0) {
      invalid(
        `purposeMapping.${id}.purposes`,
        "expected a non-empty purpose array",
      );
    }
    const purposes: number[] = [];
    for (const [index, purpose] of value.purposes.entries()) {
      if (!Number.isInteger(purpose) || purpose <= 0) {
        invalid(
          `purposeMapping.${id}.purposes[${index}]`,
          "expected a positive integer",
        );
      }
      if (purposes.includes(purpose)) {
        invalid(
          `purposeMapping.${id}.purposes[${index}]`,
          "purpose IDs must be unique",
        );
      }
      purposes.push(purpose);
    }
    normalized[id] = { purposes, match: value.match };
  }

  return Object.freeze({
    timeoutMs,
    purposeMapping: freezeMapping(normalized),
    ...(config.fallback ? { fallback: config.fallback } : {}),
  });
}

function sameConfig(
  first: NormalizedBridgeConfig,
  second: NormalizedBridgeConfig,
): boolean {
  if (
    first.timeoutMs !== second.timeoutMs ||
    first.fallback !== second.fallback
  ) {
    return false;
  }
  const firstEntries = Object.entries(first.purposeMapping).sort();
  const secondEntries = Object.entries(second.purposeMapping).sort();
  return (
    firstEntries.length === secondEntries.length &&
    firstEntries.every(([id, mapping], index) => {
      const compared = secondEntries[index];
      return (
        compared?.[0] === id &&
        compared[1].match === mapping.match &&
        compared[1].purposes.length === mapping.purposes.length &&
        mapping.purposes.every(
          (purpose, purposeIndex) =>
            compared[1].purposes[purposeIndex] === purpose,
        )
      );
    })
  );
}

function emptyRecord(): Record<string, boolean> {
  return Object.create(null) as Record<string, boolean>;
}

function cloneState(state: BridgeConsentState): BridgeConsentState {
  return {
    ...state,
    categories: { ...state.categories },
    services: { ...state.services },
  };
}

function cloneReady(payload: BridgeReadyEvent): BridgeReadyEvent {
  return {
    source: payload.source,
    consent: payload.consent ? cloneState(payload.consent) : null,
  };
}

function validBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

function stateFingerprint(state: BridgeConsentState): string {
  const categories = Object.entries(state.categories).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const services = Object.entries(state.services).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify([
    state.source,
    state.gdprApplies,
    categories,
    services,
  ]);
}

class BridgeLifecycle implements BridgeApi {
  private readonly listeners: {
    [K in keyof BridgeEvents]: Set<(payload: BridgeEvents[K]) => void>;
  } = {
    ready: new Set(),
    consent: new Set(),
    change: new Set(),
  };

  private active: BridgeConsentState | null = null;
  private activeFingerprint: string | null = null;
  private readyPayload: BridgeReadyEvent | null = null;
  private consentHasFired = false;
  private invalidated = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly startedAt = Date.now();
  private backoffMs = 10;
  private tcfApi: TcfApi | null = null;
  private listenerId: number | null = null;
  private fallbackUnsubscribes: Array<() => void> = [];

  constructor(
    private readonly config: NormalizedBridgeConfig,
    private readonly release: (lifecycle: BridgeLifecycle) => void,
  ) {
    this.poll();
  }

  getConsent(): BridgeConsentState | null {
    return this.active ? cloneState(this.active) : null;
  }

  on<K extends keyof BridgeEvents>(
    event: K,
    callback: (payload: BridgeEvents[K]) => void,
  ): () => void {
    if (this.invalidated) {
      return () => {};
    }
    this.listeners[event].add(callback);
    try {
      if (event === "ready" && this.readyPayload) {
        callback(cloneReady(this.readyPayload) as BridgeEvents[K]);
      } else if (event === "consent" && this.consentHasFired && this.active) {
        callback(cloneState(this.active) as BridgeEvents[K]);
      }
    } catch {
      // Consumer callbacks cannot interrupt bridge observation.
    }
    return () => this.off(event, callback);
  }

  off<K extends keyof BridgeEvents>(
    event: K,
    callback: (payload: BridgeEvents[K]) => void,
  ): void {
    this.listeners[event].delete(callback);
  }

  reset(): void {
    if (this.invalidated) {
      return;
    }
    this.invalidated = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tcfApi && this.listenerId !== null) {
      try {
        this.tcfApi("removeEventListener", 2, () => {}, this.listenerId);
      } catch {
        // External CMP teardown failures must not escape host cleanup.
      }
    }
    this.tcfApi = null;
    this.listenerId = null;
    for (const unsubscribe of this.fallbackUnsubscribes.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // External fallback teardown failures stay isolated.
      }
    }
    this.active = null;
    this.activeFingerprint = null;
    this.readyPayload = null;
    for (const listeners of Object.values(this.listeners)) {
      listeners.clear();
    }
    this.release(this);
  }

  getNormalizedConfig(): NormalizedBridgeConfig {
    return this.config;
  }

  private poll(): void {
    if (this.invalidated) {
      return;
    }
    let candidate: TcfApi | undefined;
    try {
      const externalApi =
        typeof window !== "undefined"
          ? Reflect.get(window, "__tcfapi")
          : undefined;
      candidate = typeof externalApi === "function" ? externalApi : undefined;
    } catch {
      candidate = undefined;
    }

    if (candidate) {
      this.tcfApi = candidate;
      try {
        candidate("addEventListener", 2, this.handleTcf);
        this.emitReady("tcf", this.active);
        return;
      } catch {
        if (this.tcfApi === candidate) {
          this.tcfApi = null;
        }
        // A present but unusable API remains eligible for retry until timeout.
      }
    }
    if (this.invalidated) {
      return;
    }

    const elapsed = Date.now() - this.startedAt;
    const remaining = this.config.timeoutMs - elapsed;
    if (remaining <= 0) {
      this.activateFallback();
      return;
    }
    const delay = Math.min(this.backoffMs, remaining);
    this.backoffMs = Math.min(this.backoffMs * 2, 250);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.poll();
    }, delay);
  }

  private readonly handleTcf: TcfCallback = (data, success) => {
    if (
      this.invalidated ||
      success !== true ||
      !data ||
      typeof data !== "object"
    ) {
      return;
    }
    if (typeof data.listenerId === "number") {
      this.listenerId = data.listenerId;
    }
    if (data.gdprApplies === false) {
      this.observeTcf(false, null);
      return;
    }
    if (
      data.gdprApplies !== true ||
      (data.eventStatus !== "tcloaded" &&
        data.eventStatus !== "useractioncomplete")
    ) {
      return;
    }
    const consents = data.purpose?.consents;
    if (!validBooleanRecord(consents)) {
      return;
    }
    this.observeTcf(true, consents);
  };

  private observeTcf(
    gdprApplies: boolean,
    purposeConsents: Record<string, boolean> | null,
  ): void {
    const categories = emptyRecord();
    categories.necessary = true;
    for (const [id, mapping] of Object.entries(this.config.purposeMapping)) {
      categories[id] =
        !gdprApplies ||
        (mapping.match === "all"
          ? mapping.purposes.every(
              (purpose) => purposeConsents?.[purpose] === true,
            )
          : mapping.purposes.some(
              (purpose) => purposeConsents?.[purpose] === true,
            ));
    }
    const state: BridgeConsentState = {
      source: "tcf",
      categories,
      services: emptyRecord(),
      gdprApplies,
      observedAt: new Date().toISOString(),
    };
    this.observe(state);
  }

  private observe(state: BridgeConsentState): void {
    if (this.invalidated) {
      return;
    }
    const fingerprint = stateFingerprint(state);
    if (fingerprint === this.activeFingerprint) {
      return;
    }
    const wasActive = this.active !== null;
    this.active = cloneState(state);
    this.activeFingerprint = fingerprint;
    this.emitReady(state.source, state);
    if (this.invalidated) {
      return;
    }
    if (!this.consentHasFired) {
      this.consentHasFired = true;
      this.emit("consent", state);
    } else if (wasActive) {
      this.emit("change", state);
    }
  }

  private emitReady(
    source: BridgeReadyEvent["source"],
    consent: BridgeConsentState | null,
  ): void {
    if (this.readyPayload || this.invalidated) {
      return;
    }
    this.readyPayload = {
      source,
      consent: consent ? cloneState(consent) : null,
    };
    this.emit("ready", this.readyPayload);
  }

  private activateFallback(): void {
    if (this.invalidated) {
      return;
    }
    const factory = this.config.fallback;
    if (!factory) {
      this.emitReady("none", null);
      return;
    }

    try {
      const fallback = factory();
      if (
        !fallback ||
        typeof fallback.getConsent !== "function" ||
        typeof fallback.on !== "function" ||
        typeof fallback.off !== "function"
      ) {
        throw new TypeError("fallback did not return a compatible API");
      }
      const onReady = (payload: BridgeFallbackReadyEvent) => {
        if (
          !payload ||
          typeof payload !== "object" ||
          (payload.consent !== null &&
            !this.validFallbackState(payload.consent))
        ) {
          return;
        }
        const state = payload.consent
          ? this.fromFallback(payload.consent)
          : null;
        if (state) {
          this.observe(state);
        } else {
          this.emitReady("fallback", null);
        }
      };
      const onConsent = (state: BridgeFallbackConsentState) => {
        if (this.validFallbackState(state)) {
          this.observe(this.fromFallback(state));
        }
      };
      const onChange = (state: BridgeFallbackConsentState) => {
        if (this.validFallbackState(state)) {
          this.observe(this.fromFallback(state));
        }
      };
      if (
        !this.registerFallbackSubscription(
          () => fallback.on("ready", onReady),
          "ready",
        )
      ) {
        return;
      }
      if (
        !this.registerFallbackSubscription(
          () => fallback.on("consent", onConsent),
          "consent",
        )
      ) {
        return;
      }
      this.registerFallbackSubscription(
        () => fallback.on("change", onChange),
        "change",
      );
    } catch {
      for (const unsubscribe of this.fallbackUnsubscribes.splice(0)) {
        try {
          unsubscribe();
        } catch {
          // Partial fallback subscription cleanup remains isolated.
        }
      }
      this.emitReady("none", null);
    }
  }

  private registerFallbackSubscription(
    subscribe: () => () => void,
    event: keyof BridgeEvents,
  ): boolean {
    const unsubscribe = subscribe();
    if (typeof unsubscribe !== "function") {
      throw new TypeError(`fallback ${event} subscription is not removable`);
    }
    if (this.invalidated) {
      try {
        unsubscribe();
      } catch {
        // A replay-triggered reset still owns and attempts this late teardown.
      }
      return false;
    }
    this.fallbackUnsubscribes.push(unsubscribe);
    return true;
  }

  private validFallbackState(
    state: BridgeFallbackConsentState,
  ): state is BridgeFallbackConsentState {
    return (
      state !== null &&
      typeof state === "object" &&
      validBooleanRecord(state.categories) &&
      validBooleanRecord(state.services)
    );
  }

  private fromFallback(state: BridgeFallbackConsentState): BridgeConsentState {
    return {
      source: "fallback",
      categories: { ...state.categories },
      services: { ...state.services },
      gdprApplies: null,
      observedAt: new Date().toISOString(),
    };
  }

  private emit<K extends keyof BridgeEvents>(
    event: K,
    payload: BridgeEvents[K],
  ): void {
    for (const callback of [...this.listeners[event]]) {
      try {
        callback(
          (event === "ready"
            ? cloneReady(payload as BridgeReadyEvent)
            : cloneState(payload as BridgeConsentState)) as BridgeEvents[K],
        );
      } catch {
        // Consumer callbacks cannot interrupt bridge or fallback lifecycles.
      }
    }
  }
}

let singleton: BridgeLifecycle | null = null;

/**
 * Initializes the read-only external-CMP bridge.
 *
 * Validation is synchronous. Discovery begins immediately and becomes
 * observable through replayable `ready` and `consent` events.
 */
export function initBridge(config: BridgeConfig = {}): BridgeApi {
  const normalized = normalizeConfig(config);
  if (singleton) {
    if (!sameConfig(singleton.getNormalizedConfig(), normalized)) {
      throw new TypeError(
        "Invalid bridge config at config: initBridge() was already called with a materially different configuration",
      );
    }
    return singleton;
  }
  singleton = new BridgeLifecycle(normalized, (released) => {
    if (singleton === released) {
      singleton = null;
    }
  });
  return singleton;
}
