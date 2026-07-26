import { ConsentError } from "./errors";
import {
  clearStored,
  persistState,
  readStored,
  reconcileStored,
} from "./storage";
import type {
  ConsentApi,
  ConsentEvents,
  ConsentPrefill,
  ConsentSelection,
  ConsentState,
  NormalizedCategoryConfig,
  NormalizedCmpConfig,
  ReadyEvent,
} from "./types";

type DecisionKind = "accept" | "reject" | "selection" | "withdraw";

interface QueuedDecision {
  kind: DecisionKind;
  selection?: ConsentSelection;
}

interface ServiceLocation {
  category: NormalizedCategoryConfig;
  regions: string[];
}

function cloneState(state: ConsentState): ConsentState {
  return {
    ...state,
    categories: { ...state.categories },
    services: { ...state.services },
  };
}

function clonePrefill(prefill: ConsentPrefill): ConsentPrefill {
  return {
    categories: { ...prefill.categories },
    services: { ...prefill.services },
  };
}

function cloneReady(payload: ReadyEvent): ReadyEvent {
  return {
    reason: payload.reason,
    consent: payload.consent ? cloneState(payload.consent) : null,
    ...(payload.prefill ? { prefill: clonePrefill(payload.prefill) } : {}),
  };
}

function cloneSelection(selection: ConsentSelection): ConsentSelection {
  return {
    ...(selection.categories
      ? { categories: { ...selection.categories } }
      : {}),
    ...(selection.services ? { services: { ...selection.services } } : {}),
  };
}

function emptyChoices(): Record<string, boolean> {
  return Object.create(null) as Record<string, boolean>;
}

function uuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

function now(): string {
  return new Date().toISOString();
}

export class ConsentLifecycle implements ConsentApi {
  private readonly listeners: {
    [K in keyof ConsentEvents]: Set<(payload: ConsentEvents[K]) => void>;
  } = {
    ready: new Set(),
    consent: new Set(),
    change: new Set(),
  };

  private readonly services = new Map<string, ServiceLocation>();

  private active: ConsentState | null = null;

  private readyPayload: ReadyEvent | null = null;

  private consentHasFired = false;

  private initialized = false;

  private invalidated = false;

  private queue: QueuedDecision[] = [];

  private region: string | null = null;

  constructor(
    private readonly config: NormalizedCmpConfig,
    private readonly release: (lifecycle: ConsentLifecycle) => void,
  ) {
    for (const category of config.categories) {
      for (const service of category.services) {
        this.services.set(service.id, {
          category,
          regions: service.onlyRegions,
        });
      }
    }
    void this.initialize();
  }

  getConsent(): ConsentState | null {
    return this.active ? cloneState(this.active) : null;
  }

  acceptAll(): void {
    this.enqueueOrApply({ kind: "accept" });
  }

  rejectAll(): void {
    this.enqueueOrApply({ kind: "reject" });
  }

  setConsent(selection: ConsentSelection): void {
    this.validateSelection(selection);
    this.enqueueOrApply({
      kind: "selection",
      selection: cloneSelection(selection),
    });
  }

  withdraw(): void {
    this.enqueueOrApply({ kind: "withdraw" });
  }

  showPreferences(): void {
    // Phase 1 intentionally has no DOM renderer. This remains a safe UI intent.
  }

  hide(): void {
    // Phase 1 intentionally has no DOM renderer. This remains a safe UI intent.
  }

  on<K extends keyof ConsentEvents>(
    event: K,
    callback: (payload: ConsentEvents[K]) => void,
  ): () => void {
    this.listeners[event].add(callback);
    if (event === "ready" && this.readyPayload) {
      callback(cloneReady(this.readyPayload) as ConsentEvents[K]);
    } else if (event === "consent" && this.consentHasFired && this.active) {
      callback(cloneState(this.active) as ConsentEvents[K]);
    }
    return () => this.off(event, callback);
  }

  off<K extends keyof ConsentEvents>(
    event: K,
    callback: (payload: ConsentEvents[K]) => void,
  ): void {
    this.listeners[event].delete(callback);
  }

  getConfig(): NormalizedCmpConfig {
    return this.config;
  }

  reset(): void {
    if (this.invalidated) {
      return;
    }
    this.invalidated = true;
    this.queue = [];
    this.active = null;
    this.readyPayload = null;
    for (const listeners of Object.values(this.listeners)) {
      listeners.clear();
    }
    clearStored(this.config.storage);
    this.release(this);
  }

  private async initialize(): Promise<void> {
    if (this.config.resolveRegion) {
      try {
        const resolved = await this.config.resolveRegion();
        this.region = resolved?.trim() ? resolved.trim().toUpperCase() : null;
      } catch {
        this.region = null;
      }
    }
    if (this.invalidated) {
      return;
    }

    const stored = readStored(this.config.storage);
    if (stored.decision) {
      reconcileStored(this.config.storage, stored);
    }

    let reason: ReadyEvent["reason"] = "new";
    let prefill: ConsentPrefill | undefined;
    const storedState = stored.decision?.state;
    if (storedState) {
      const expired =
        Date.now() - Date.parse(storedState.updatedAt) >=
        this.config.storage.expiresDays * 24 * 60 * 60 * 1000;
      if (expired) {
        reason = "expired";
      } else if (storedState.revision < this.config.revision) {
        reason = "revision";
        prefill = this.sanitizeChoices(storedState);
      } else if (storedState.revision === this.config.revision) {
        reason = "restored";
        this.active = this.sanitizeStoredState(storedState);
      }
    }

    this.readyPayload =
      prefill === undefined
        ? {
            reason,
            consent: this.active ? cloneState(this.active) : null,
          }
        : {
            reason,
            consent: null,
            prefill,
          };
    this.emit("ready", this.readyPayload);
    if (this.active) {
      this.consentHasFired = true;
      this.emit("consent", cloneState(this.active));
    }

    let decision = this.queue.shift();
    while (decision) {
      if (this.invalidated) {
        return;
      }
      this.applyDecision(decision);
      decision = this.queue.shift();
    }
    this.initialized = true;
  }

  private enqueueOrApply(decision: QueuedDecision): void {
    if (this.invalidated) {
      return;
    }
    if (!this.initialized) {
      this.queue.push(decision);
      return;
    }
    this.applyDecision(decision);
  }

  private validateSelection(selection: ConsentSelection): void {
    if (
      selection === null ||
      typeof selection !== "object" ||
      Array.isArray(selection)
    ) {
      throw new ConsentError(
        "INVALID_SELECTION",
        "selection",
        "must be an object",
      );
    }
    if (selection.categories !== undefined) {
      this.validateBooleanRecord(selection.categories, "selection.categories");
      for (const [id, value] of Object.entries(selection.categories)) {
        const category = this.config.categories.find(
          (entry) => entry.id === id,
        );
        if (!category) {
          throw new ConsentError(
            "INVALID_SELECTION",
            `selection.categories.${id}`,
            "references an unknown category",
          );
        }
        if (category.readonly && value !== category.enabled) {
          throw new ConsentError(
            "INVALID_SELECTION",
            `selection.categories.${id}`,
            "cannot change a readonly category",
          );
        }
      }
    }
    if (selection.services !== undefined) {
      this.validateBooleanRecord(selection.services, "selection.services");
      for (const id of Object.keys(selection.services)) {
        const service = this.services.get(id);
        if (!service) {
          throw new ConsentError(
            "INVALID_SELECTION",
            `selection.services.${id}`,
            "references an unknown service",
          );
        }
        if (service.category.readonly) {
          throw new ConsentError(
            "INVALID_SELECTION",
            `selection.services.${id}`,
            "cannot change a service in a readonly category",
          );
        }
      }
    }
  }

  private validateBooleanRecord(value: unknown, path: string): void {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new ConsentError("INVALID_SELECTION", path, "must be an object");
    }
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== "boolean") {
        throw new ConsentError(
          "INVALID_SELECTION",
          `${path}.${key}`,
          "must be a boolean",
        );
      }
    }
  }

  private applyDecision(decision: QueuedDecision): void {
    const previous = this.active;
    const base = previous
      ? cloneState(previous)
      : this.createBaseState(
          decision.kind === "selection"
            ? this.readyPayload?.prefill
            : undefined,
        );

    if (decision.kind === "accept") {
      this.applyAll(base, true);
    } else if (decision.kind === "reject" || decision.kind === "withdraw") {
      this.applyAll(base, false);
    } else if (decision.selection) {
      this.applySelection(base, decision.selection);
    }

    base.updatedAt = now();
    this.active = base;
    persistState(this.config.storage, base);

    if (decision.kind === "withdraw") {
      this.emit("change", cloneState(base));
      return;
    }
    if (!this.consentHasFired) {
      this.consentHasFired = true;
      this.emit("consent", cloneState(base));
    } else {
      this.emit("change", cloneState(base));
    }
  }

  private createBaseState(prefill?: ConsentPrefill): ConsentState {
    const timestamp = now();
    const state: ConsentState = {
      consentId: uuid(),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: this.config.revision,
      categories: emptyChoices(),
      services: emptyChoices(),
      ...(this.region ? { region: this.region } : {}),
    };
    for (const category of this.config.categories) {
      state.categories[category.id] =
        !category.readonly && category.services.length === 0
          ? (prefill?.categories[category.id] ?? category.enabled)
          : category.enabled;
      for (const service of category.services) {
        const selected = prefill?.services[service.id] ?? category.enabled;
        state.services[service.id] =
          selected && this.isApplicable(service.onlyRegions);
      }
      this.recomputeCategory(state, category);
    }
    return state;
  }

  private applyAll(state: ConsentState, value: boolean): void {
    for (const category of this.config.categories) {
      if (category.readonly) {
        state.categories[category.id] = category.enabled;
        for (const service of category.services) {
          state.services[service.id] =
            category.enabled && this.isApplicable(service.onlyRegions);
        }
      } else {
        for (const service of category.services) {
          state.services[service.id] =
            value && this.isApplicable(service.onlyRegions);
        }
        state.categories[category.id] =
          category.services.length === 0 ? value : false;
      }
      this.recomputeCategory(state, category);
    }
  }

  private applySelection(
    state: ConsentState,
    selection: ConsentSelection,
  ): void {
    for (const [categoryId, value] of Object.entries(
      selection.categories ?? {},
    )) {
      const category = this.config.categories.find(
        (entry) => entry.id === categoryId,
      );
      if (!category || category.readonly) {
        continue;
      }
      if (category.services.length === 0) {
        state.categories[category.id] = value;
      }
      for (const service of category.services) {
        state.services[service.id] =
          value && this.isApplicable(service.onlyRegions);
      }
    }
    for (const [serviceId, value] of Object.entries(selection.services ?? {})) {
      const service = this.services.get(serviceId);
      if (!service || service.category.readonly) {
        continue;
      }
      state.services[serviceId] = value && this.isApplicable(service.regions);
    }
    for (const category of this.config.categories) {
      this.recomputeCategory(state, category);
    }
  }

  private recomputeCategory(
    state: ConsentState,
    category: NormalizedCategoryConfig,
  ): void {
    if (category.id === "necessary") {
      state.categories[category.id] = true;
      return;
    }
    if (category.readonly) {
      state.categories[category.id] = category.enabled;
      return;
    }
    if (category.services.length > 0) {
      state.categories[category.id] = category.services.some(
        (service) => state.services[service.id] === true,
      );
    }
  }

  private sanitizeChoices(state: ConsentState): ConsentPrefill {
    const sanitized = this.createBaseState();
    for (const category of this.config.categories) {
      if (!category.readonly && category.services.length === 0) {
        sanitized.categories[category.id] =
          state.categories[category.id] ?? false;
      }
      for (const service of category.services) {
        if (!category.readonly) {
          sanitized.services[service.id] =
            (state.services[service.id] ?? false) &&
            this.isApplicable(service.onlyRegions);
        }
      }
      this.recomputeCategory(sanitized, category);
    }
    return {
      categories: { ...sanitized.categories },
      services: { ...sanitized.services },
    };
  }

  private sanitizeStoredState(state: ConsentState): ConsentState {
    const sanitized = this.sanitizeChoices(state);
    return {
      consentId: state.consentId,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      revision: state.revision,
      categories: sanitized.categories,
      services: sanitized.services,
      ...(this.region ? { region: this.region } : {}),
      ...(state.gpcApplied === undefined
        ? {}
        : { gpcApplied: state.gpcApplied }),
    };
  }

  private isApplicable(regions: string[]): boolean {
    return (
      regions.length === 0 ||
      (this.region !== null && regions.includes(this.region))
    );
  }

  private emit<K extends keyof ConsentEvents>(
    event: K,
    payload: ConsentEvents[K],
  ): void {
    for (const callback of [...this.listeners[event]]) {
      if (event === "ready") {
        try {
          callback(cloneReady(payload as ReadyEvent) as ConsentEvents[K]);
        } catch {
          // Consumer callbacks must not interrupt initialization or queued decisions.
        }
      } else {
        try {
          callback(cloneState(payload as ConsentState) as ConsentEvents[K]);
        } catch {
          // Consumer callbacks must not interrupt the consent lifecycle.
        }
      }
    }
  }
}
