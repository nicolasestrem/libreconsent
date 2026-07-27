import type { ConsentApi } from "@libreconsent/core";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  type BridgeApi,
  type BridgeConfig,
  type BridgeEvents,
  type BridgeFallbackApi,
  type BridgeFallbackConsentState,
  type BridgeFallbackReadyEvent,
  DEFAULT_PURPOSE_MAPPING,
  initBridge,
} from "./index";

type TcfApi = NonNullable<Window["__tcfapi"]>;
type TcfApiCallback = Parameters<TcfApi>[2];

interface StubTcData {
  eventStatus?: string;
  gdprApplies?: boolean;
  listenerId?: number;
  purpose?: {
    consents?: unknown;
  };
}

let activeApi: BridgeApi | undefined;

function setTcfApi(api: TcfApi): void {
  Object.defineProperty(window, "__tcfapi", {
    configurable: true,
    value: api,
    writable: true,
  });
}

function invokeTcfCallback(
  callback: TcfApiCallback,
  data: StubTcData,
  success = true,
): void {
  (callback as (data: StubTcData, successful: boolean) => void)(data, success);
}

function start(config: Parameters<typeof initBridge>[0] = {}): BridgeApi {
  activeApi = initBridge(config);
  return activeApi;
}

function tcfData(
  consents: Record<number, boolean>,
  overrides: Partial<StubTcData> = {},
): StubTcData {
  return {
    eventStatus: "tcloaded",
    gdprApplies: true,
    listenerId: 41,
    purpose: { consents },
    ...overrides,
  };
}

class FallbackStub implements BridgeFallbackApi {
  readonly reset = vi.fn();

  private readonly listeners = {
    ready: new Set<(payload: BridgeFallbackReadyEvent) => void>(),
    consent: new Set<(payload: BridgeFallbackConsentState) => void>(),
    change: new Set<(payload: BridgeFallbackConsentState) => void>(),
  };

  private active: BridgeFallbackConsentState | null = null;

  getConsent(): BridgeFallbackConsentState | null {
    return this.active;
  }

  on(
    event: "ready",
    callback: (payload: BridgeFallbackReadyEvent) => void,
  ): () => void;
  on(
    event: "consent" | "change",
    callback: (payload: BridgeFallbackConsentState) => void,
  ): () => void;
  on(
    event: keyof typeof this.listeners,
    callback:
      | ((payload: BridgeFallbackReadyEvent) => void)
      | ((payload: BridgeFallbackConsentState) => void),
  ): () => void {
    const listeners = this.listeners[event] as Set<typeof callback>;
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  off(
    event: "ready",
    callback: (payload: BridgeFallbackReadyEvent) => void,
  ): void;
  off(
    event: "consent" | "change",
    callback: (payload: BridgeFallbackConsentState) => void,
  ): void;
  off(
    event: keyof typeof this.listeners,
    callback:
      | ((payload: BridgeFallbackReadyEvent) => void)
      | ((payload: BridgeFallbackConsentState) => void),
  ): void {
    const listeners = this.listeners[event] as Set<typeof callback>;
    listeners.delete(callback);
  }

  emitReady(consent: BridgeFallbackConsentState | null): void {
    for (const callback of this.listeners.ready) {
      callback({ consent });
    }
  }

  emit(event: "consent" | "change", consent: BridgeFallbackConsentState): void {
    this.active = consent;
    for (const callback of this.listeners[event]) {
      callback(consent);
    }
  }

  listenerCount(): number {
    return Object.values(this.listeners).reduce(
      (count, listeners) => count + listeners.size,
      0,
    );
  }
}

afterEach(() => {
  activeApi?.reset();
  activeApi = undefined;
  Reflect.deleteProperty(window, "__tcfapi");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("configuration", () => {
  test("accepts a core ConsentApi factory structurally without a runtime import", () => {
    expectTypeOf<() => ConsentApi>().toMatchTypeOf<
      NonNullable<BridgeConfig["fallback"]>
    >();
  });

  test("ships a deeply frozen strict default mapping", () => {
    expect(DEFAULT_PURPOSE_MAPPING).toEqual({
      analytics: { purposes: [1, 7, 8, 9, 10], match: "all" },
      marketing: { purposes: [1, 2, 3, 4], match: "all" },
    });
    const analytics = DEFAULT_PURPOSE_MAPPING.analytics;
    if (!analytics) {
      throw new Error("default analytics mapping is missing");
    }
    expect(Object.isFrozen(DEFAULT_PURPOSE_MAPPING)).toBe(true);
    expect(Object.isFrozen(analytics)).toBe(true);
    expect(Object.isFrozen(analytics.purposes)).toBe(true);
    expect(() => (analytics.purposes as number[]).push(11)).toThrow();
  });

  test.each([
    [{ timeoutMs: 0 }, "timeoutMs"],
    [{ timeoutMs: 1.5 }, "timeoutMs"],
    [
      {
        purposeMapping: {
          necessary: { purposes: [1], match: "all" as const },
        },
      },
      "purposeMapping.necessary",
    ],
    [
      {
        purposeMapping: {
          " analytics": { purposes: [1], match: "all" as const },
        },
      },
      "purposeMapping. analytics",
    ],
    [
      {
        purposeMapping: {
          analytics: { purposes: [], match: "all" as const },
        },
      },
      "purposeMapping.analytics.purposes",
    ],
    [
      {
        purposeMapping: {
          analytics: { purposes: [0], match: "all" as const },
        },
      },
      "purposeMapping.analytics.purposes[0]",
    ],
    [
      {
        purposeMapping: {
          analytics: { purposes: [1, 1], match: "all" as const },
        },
      },
      "purposeMapping.analytics.purposes[1]",
    ],
    [
      {
        purposeMapping: {
          analytics: {
            purposes: [1],
            match: "some" as "all",
          },
        },
      },
      "purposeMapping.analytics.match",
    ],
    [{ fallback: 1 as never }, "fallback"],
  ])("rejects invalid config at its exact path", (config, path) => {
    expect(() => initBridge(config)).toThrow(path);
  });

  test("normalizes equivalent configs for singleton compatibility", () => {
    vi.useFakeTimers();
    const fallback = () => new FallbackStub();
    const first = start({
      timeoutMs: 50,
      purposeMapping: {
        analytics: { purposes: [1, 7], match: "all" },
      },
      fallback,
    });
    const second = initBridge({
      timeoutMs: 50,
      purposeMapping: {
        analytics: { purposes: [1, 7], match: "all" },
      },
      fallback,
    });

    expect(second).toBe(first);
    expect(() =>
      initBridge({
        timeoutMs: 51,
        purposeMapping: {
          analytics: { purposes: [1, 7], match: "all" },
        },
        fallback,
      }),
    ).toThrow("materially different");
  });

  test("reset releases the singleton for a different configuration", () => {
    vi.useFakeTimers();
    const first = start({ timeoutMs: 10 });
    first.reset();

    const second = start({ timeoutMs: 20 });
    expect(second).not.toBe(first);
  });
});

describe("TCF observation", () => {
  test("emits ready before consent for an initial loaded state", () => {
    const order: string[] = [];
    setTcfApi((command, _version, callback) => {
      if (command === "addEventListener") {
        invokeTcfCallback(
          callback,
          tcfData({
            1: true,
            2: true,
            3: true,
            4: true,
            7: true,
            8: true,
            9: true,
            10: true,
          }),
        );
      }
    });

    const api = start();
    api.on("ready", (payload) => {
      order.push(`ready:${payload.source}`);
      expect(payload.consent?.categories).toEqual({
        necessary: true,
        analytics: true,
        marketing: true,
      });
    });
    api.on("consent", (payload) => {
      order.push(`consent:${payload.source}`);
    });

    expect(order).toEqual(["ready:tcf", "consent:tcf"]);
    expect(api.getConsent()).toMatchObject({
      source: "tcf",
      gdprApplies: true,
      services: {},
    });
  });

  test("supports complete replacement mappings with all and any aggregation", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start({
      purposeMapping: {
        measurement: { purposes: [1, 7], match: "all" },
        personalization: { purposes: [3, 4], match: "any" },
      },
    });

    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData({ 1: true, 7: false, 3: false, 4: true }),
    );

    expect(api.getConsent()?.categories).toEqual({
      necessary: true,
      measurement: false,
      personalization: true,
    });
    expect(api.getConsent()?.categories).not.toHaveProperty("analytics");
  });

  test("grants every mapped category when GDPR does not apply", () => {
    setTcfApi((command, _version, callback) => {
      if (command === "addEventListener") {
        invokeTcfCallback(callback, {
          gdprApplies: false,
          listenerId: 12,
        });
      }
    });

    const consent = start().getConsent();
    expect(consent).toMatchObject({
      source: "tcf",
      gdprApplies: false,
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
    });
  });

  test("establishes TCF ready for a queued stub before usable data", () => {
    const ready = vi.fn();
    const consent = vi.fn();
    setTcfApi(() => {});

    const api = start();
    api.on("ready", ready);
    api.on("consent", consent);

    expect(ready).toHaveBeenCalledWith({ source: "tcf", consent: null });
    expect(consent).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();
  });

  test("removes a queued CMP listener whose first callback arrives after reset", () => {
    let callback: TcfApiCallback | undefined;
    const external = vi.fn<TcfApi>(
      (command, _version, registered, listenerId) => {
        if (command === "addEventListener") {
          callback = registered;
        } else {
          expect(listenerId).toBe(92);
        }
      },
    );
    setTcfApi(external);
    const api = start();
    const ready = vi.fn();
    const consent = vi.fn();
    const change = vi.fn();
    api.on("ready", ready);
    api.on("consent", consent);
    api.on("change", change);
    expect(ready).toHaveBeenCalledWith({ source: "tcf", consent: null });

    api.reset();
    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData(
        {
          1: true,
          2: true,
          3: true,
          4: true,
          7: true,
          8: true,
          9: true,
          10: true,
        },
        { listenerId: 92 },
      ),
    );

    expect(external.mock.calls.map(([command]) => command)).toEqual([
      "addEventListener",
      "removeEventListener",
    ]);
    expect(ready).toHaveBeenCalledOnce();
    expect(consent).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();
  });

  test("does not treat initial cmpuishown false values as a decision", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
        invokeTcfCallback(
          registered,
          tcfData(
            {
              1: false,
              2: false,
              3: false,
              4: false,
              7: false,
              8: false,
              9: false,
              10: false,
            },
            { eventStatus: "cmpuishown" },
          ),
        );
      }
    });
    const consent = vi.fn();
    const api = start();
    api.on("consent", consent);

    expect(api.getConsent()).toBeNull();
    expect(consent).not.toHaveBeenCalled();

    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData(
        {
          1: true,
          2: false,
          3: false,
          4: false,
          7: true,
          8: true,
          9: true,
          10: true,
        },
        { eventStatus: "useractioncomplete" },
      ),
    );
    expect(consent).toHaveBeenCalledOnce();
    expect(api.getConsent()?.categories.analytics).toBe(true);
    expect(api.getConsent()?.categories.marketing).toBe(false);
  });

  test("ignores unsuccessful and malformed callbacks", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start();
    const consent = vi.fn();
    api.on("consent", consent);

    invokeTcfCallback(callback as TcfApiCallback, tcfData({ 1: true }), false);
    invokeTcfCallback(callback as TcfApiCallback, {
      eventStatus: "tcloaded",
      gdprApplies: true,
      purpose: { consents: { 1: "yes" } },
    });
    invokeTcfCallback(callback as TcfApiCallback, {
      eventStatus: "loading",
      gdprApplies: true,
      purpose: { consents: { 1: true } },
    });

    expect(consent).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();
  });

  test("suppresses duplicates and emits change only for later material state", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start();
    const consent = vi.fn();
    const change = vi.fn();
    api.on("consent", consent);
    api.on("change", change);
    const first = tcfData({
      1: true,
      2: false,
      3: false,
      4: false,
      7: true,
      8: true,
      9: true,
      10: true,
    });

    invokeTcfCallback(callback as TcfApiCallback, first);
    invokeTcfCallback(callback as TcfApiCallback, {
      ...first,
      listenerId: 99,
      eventStatus: "useractioncomplete",
    });
    expect(consent).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();

    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData(
        {
          1: true,
          2: true,
          3: true,
          4: true,
          7: true,
          8: true,
          9: true,
          10: true,
        },
        { eventStatus: "useractioncomplete" },
      ),
    );
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0]?.[0].categories.marketing).toBe(true);
  });

  test("replays ready and consent, never change, with defensive callback copies", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start();
    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData({
        1: true,
        2: false,
        3: false,
        4: false,
        7: true,
        8: true,
        9: true,
        10: true,
      }),
    );

    api.on("consent", (state) => {
      state.categories.analytics = false;
      throw new Error("consumer");
    });
    const replay = vi.fn();
    const noReplay = vi.fn();
    api.on("consent", replay);
    api.on("change", noReplay);

    expect(replay).toHaveBeenCalledOnce();
    expect(replay.mock.calls[0]?.[0].categories.analytics).toBe(true);
    expect(noReplay).not.toHaveBeenCalled();
    expect(api.getConsent()?.categories.analytics).toBe(true);
  });

  test("gives replayed ready callbacks defensive state copies", () => {
    setTcfApi((command, _version, callback) => {
      if (command === "addEventListener") {
        invokeTcfCallback(
          callback,
          tcfData({
            1: true,
            2: false,
            3: false,
            4: false,
            7: true,
            8: true,
            9: true,
            10: true,
          }),
        );
      }
    });
    const api = start();
    api.on("ready", (payload) => {
      if (payload.consent) {
        payload.consent.categories.analytics = false;
      }
    });
    const replay = vi.fn();
    api.on("ready", replay);

    expect(replay.mock.calls[0]?.[0].consent?.categories.analytics).toBe(true);
    expect(api.getConsent()?.categories.analytics).toBe(true);
  });

  test("supports off and unsubscribe without affecting other listeners", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start();
    const removedByOff = vi.fn();
    const removedByUnsubscribe = vi.fn();
    const survivor = vi.fn();
    api.on("consent", removedByOff);
    api.off("consent", removedByOff);
    const unsubscribe = api.on("consent", removedByUnsubscribe);
    unsubscribe();
    api.on("consent", survivor);

    invokeTcfCallback(
      callback as TcfApiCallback,
      tcfData({
        1: true,
        2: true,
        3: true,
        4: true,
        7: true,
        8: true,
        9: true,
        10: true,
      }),
    );

    expect(removedByOff).not.toHaveBeenCalled();
    expect(removedByUnsubscribe).not.toHaveBeenCalled();
    expect(survivor).toHaveBeenCalledOnce();
  });

  test("isolates a throwing emitted callback from later callbacks", () => {
    let callback: TcfApiCallback | undefined;
    setTcfApi((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    const api = start();
    api.on("consent", () => {
      throw new Error("consumer");
    });
    const survivor = vi.fn();
    api.on("consent", survivor);

    expect(() =>
      invokeTcfCallback(
        callback as TcfApiCallback,
        tcfData({
          1: true,
          2: true,
          3: true,
          4: true,
          7: true,
          8: true,
          9: true,
          10: true,
        }),
      ),
    ).not.toThrow();
    expect(survivor).toHaveBeenCalledOnce();
  });
});

describe("discovery and teardown", () => {
  test("polls with exponential backoff capped at 250 ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
    const reads: number[] = [];
    Object.defineProperty(window, "__tcfapi", {
      configurable: true,
      get: () => {
        reads.push(Date.now());
        return undefined;
      },
    });

    start({ timeoutMs: 1000 });
    vi.advanceTimersByTime(560);

    const firstRead = reads[0] ?? 0;
    expect(reads.map((time) => time - firstRead)).toEqual([
      0, 10, 30, 70, 150, 310, 560,
    ]);
  });

  test("discovers a CMP that appears after initialization", () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const api = start({ timeoutMs: 100 });
    api.on("ready", ready);

    vi.advanceTimersByTime(9);
    setTcfApi(() => {});
    vi.advanceTimersByTime(1);

    expect(ready).toHaveBeenCalledWith({ source: "tcf", consent: null });
  });

  test("removes a delayed CMP listener when synchronous ready resets the bridge", () => {
    vi.useFakeTimers();
    const external = vi.fn<TcfApi>(
      (command, _version, callback, listenerId) => {
        if (command === "addEventListener") {
          invokeTcfCallback(
            callback,
            tcfData(
              {
                1: true,
                2: true,
                3: true,
                4: true,
                7: true,
                8: true,
                9: true,
                10: true,
              },
              { listenerId: 88 },
            ),
          );
        } else {
          expect(listenerId).toBe(88);
        }
      },
    );
    const api = start({ timeoutMs: 100 });
    api.on("ready", () => api.reset());
    setTcfApi(external);

    vi.advanceTimersByTime(10);

    expect(external.mock.calls.map(([command]) => command)).toEqual([
      "addEventListener",
      "removeEventListener",
    ]);
    expect(api.getConsent()).toBeNull();
  });

  test("emits one replayable none outcome at the deadline", () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const api = start({ timeoutMs: 25 });
    api.on("ready", ready);

    vi.advanceTimersByTime(24);
    expect(ready).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ready).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledWith({ source: "none", consent: null });

    const replay = vi.fn();
    api.on("ready", replay);
    vi.advanceTimersByTime(1000);
    expect(replay).toHaveBeenCalledOnce();
  });

  test("retries a throwing CMP API until it becomes callable", () => {
    vi.useFakeTimers();
    let throws = true;
    const external = vi.fn(() => {
      if (throws) {
        throw new Error("loading");
      }
    });
    setTcfApi(external);
    const ready = vi.fn();
    const api = start({ timeoutMs: 50 });
    api.on("ready", ready);
    expect(ready).not.toHaveBeenCalled();

    throws = false;
    vi.advanceTimersByTime(10);
    expect(external).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenCalledWith({ source: "tcf", consent: null });
  });

  test("removes the exact CMP listener during teardown", () => {
    let callback: TcfApiCallback | undefined;
    const external = vi.fn<TcfApi>(
      (command, _version, registered, parameter) => {
        if (command === "addEventListener") {
          callback = registered;
        } else {
          expect(parameter).toBe(73);
        }
      },
    );
    setTcfApi(external);
    const api = start();
    invokeTcfCallback(callback as TcfApiCallback, {
      eventStatus: "cmpuishown",
      gdprApplies: true,
      listenerId: 73,
      purpose: { consents: {} },
    });

    api.reset();

    expect(external.mock.calls.map(([command]) => command)).toEqual([
      "addEventListener",
      "removeEventListener",
    ]);
  });

  test("ignores a non-numeric listener ID instead of removing the wrong listener", () => {
    let callback: TcfApiCallback | undefined;
    const external = vi.fn<TcfApi>((command, _version, registered) => {
      if (command === "addEventListener") {
        callback = registered;
      }
    });
    setTcfApi(external);
    const api = start();
    invokeTcfCallback(
      callback as TcfApiCallback,
      {
        eventStatus: "cmpuishown",
        gdprApplies: true,
        listenerId: "not-a-v2-listener",
        purpose: { consents: {} },
      } as unknown as StubTcData,
    );

    api.reset();

    expect(external.mock.calls.map(([command]) => command)).toEqual([
      "addEventListener",
    ]);
  });

  test("reset cancels polling and clears all bridge memory", () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const api = start({ timeoutMs: 50 });
    api.on("ready", ready);
    api.reset();
    vi.advanceTimersByTime(100);

    expect(ready).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();
    expect(api.on("ready", ready)).toEqual(expect.any(Function));
    expect(ready).not.toHaveBeenCalled();
  });
});

describe("fallback handoff", () => {
  test("makes non-null fallback ready consent active before ready callbacks", () => {
    vi.useFakeTimers();
    const fallback = new FallbackStub();
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    const readyConsent = vi.fn();
    const consent = vi.fn();
    api.on("ready", (payload) => {
      readyConsent(api.getConsent());
      expect(payload.consent).toEqual(api.getConsent());
      if (payload.consent) {
        payload.consent.categories.analytics = false;
      }
    });
    api.on("consent", consent);
    vi.advanceTimersByTime(10);

    fallback.emitReady({
      categories: { necessary: true, analytics: true },
      services: { ga: true },
    });

    expect(readyConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "fallback",
        categories: { necessary: true, analytics: true },
        services: { ga: true },
      }),
    );
    expect(consent).toHaveBeenCalledOnce();
    const replay = vi.fn();
    api.on("ready", replay);
    expect(replay.mock.calls[0]?.[0].consent?.categories.analytics).toBe(true);
    expect(api.getConsent()?.categories.analytics).toBe(true);
  });

  test("proxies fallback ready, consent, change, and service choices", () => {
    vi.useFakeTimers();
    const fallback = new FallbackStub();
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    const events: Array<keyof BridgeEvents> = [];
    const ready = vi.fn(() => events.push("ready"));
    const consent = vi.fn(() => events.push("consent"));
    const change = vi.fn(() => events.push("change"));
    api.on("ready", ready);
    api.on("consent", consent);
    api.on("change", change);

    vi.advanceTimersByTime(10);
    expect(ready).not.toHaveBeenCalled();
    fallback.emitReady(null);
    expect(ready).toHaveBeenCalledWith({ source: "fallback", consent: null });

    fallback.emit("consent", {
      categories: { necessary: true, analytics: true },
      services: { ga: true },
    });
    fallback.emit("change", {
      categories: { necessary: true, analytics: false },
      services: { ga: false },
    });

    expect(events).toEqual(["ready", "consent", "change"]);
    expect(api.getConsent()).toMatchObject({
      source: "fallback",
      gdprApplies: null,
      categories: { necessary: true, analytics: false },
      services: { ga: false },
    });
  });

  test("does not emit none before a fallback establishes ready", () => {
    vi.useFakeTimers();
    const fallback = new FallbackStub();
    const ready = vi.fn();
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    api.on("ready", ready);

    vi.advanceTimersByTime(10);
    expect(ready).not.toHaveBeenCalled();
    fallback.emitReady(null);
    expect(ready.mock.calls.map(([payload]) => payload.source)).toEqual([
      "fallback",
    ]);
  });

  test("fails closed to none when the fallback factory throws", () => {
    vi.useFakeTimers();
    const api = start({
      timeoutMs: 10,
      fallback: () => {
        throw new Error("factory");
      },
    });
    const ready = vi.fn();
    api.on("ready", ready);

    expect(() => vi.advanceTimersByTime(10)).not.toThrow();
    expect(ready).toHaveBeenCalledWith({ source: "none", consent: null });
  });

  test("fails closed when the fallback API is malformed", () => {
    vi.useFakeTimers();
    const api = start({
      timeoutMs: 10,
      fallback: () => ({}) as BridgeFallbackApi,
    });
    const ready = vi.fn();
    api.on("ready", ready);

    vi.advanceTimersByTime(10);
    expect(ready).toHaveBeenCalledWith({ source: "none", consent: null });
  });

  test("cleans an earlier fallback subscription when a later one throws", () => {
    vi.useFakeTimers();
    const unsubscribeReady = vi.fn();
    const fallback = {
      getConsent: () => null,
      on: vi.fn((event: string) => {
        if (event === "ready") {
          return unsubscribeReady;
        }
        throw new Error("subscription");
      }),
      off: vi.fn(),
    } as unknown as BridgeFallbackApi;
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    const ready = vi.fn();
    api.on("ready", ready);

    vi.advanceTimersByTime(10);

    expect(unsubscribeReady).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledWith({ source: "none", consent: null });
  });

  test("ignores captured fallback callbacks invoked after reset", () => {
    vi.useFakeTimers();
    const callbacks = new Map<string, (payload: unknown) => void>();
    const fallback = {
      getConsent: () => null,
      on: vi.fn((event: string, callback: (payload: unknown) => void) => {
        callbacks.set(event, callback);
        return vi.fn();
      }),
      off: vi.fn(),
    } as unknown as BridgeFallbackApi;
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    vi.advanceTimersByTime(10);
    api.reset();

    callbacks.get("ready")?.({
      consent: {
        categories: { necessary: true, analytics: true },
        services: { ga: true },
      },
    });
    callbacks.get("consent")?.({
      categories: { necessary: true, analytics: true },
      services: { ga: true },
    });
    callbacks.get("change")?.({
      categories: { necessary: true, analytics: false },
      services: { ga: false },
    });

    expect(api.getConsent()).toBeNull();
  });

  test("immediately tears down synchronous fallback replay when ready resets", () => {
    vi.useFakeTimers();
    const unsubscribeReady = vi.fn();
    const subscribedEvents: string[] = [];
    const fallback = {
      getConsent: () => null,
      on: vi.fn(
        (
          event: string,
          callback: (payload: BridgeFallbackReadyEvent) => void,
        ) => {
          subscribedEvents.push(event);
          if (event === "ready") {
            callback({ consent: null });
            return unsubscribeReady;
          }
          return vi.fn();
        },
      ),
      off: vi.fn(),
    } as unknown as BridgeFallbackApi;
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    api.on("ready", () => api.reset());

    vi.advanceTimersByTime(10);

    expect(unsubscribeReady).toHaveBeenCalledOnce();
    expect(subscribedEvents).toEqual(["ready"]);
    expect(api.getConsent()).toBeNull();
  });

  test("unsubscribes forwarding without calling the fallback reset", () => {
    vi.useFakeTimers();
    const fallback = new FallbackStub();
    const api = start({ timeoutMs: 10, fallback: () => fallback });
    vi.advanceTimersByTime(10);
    expect(fallback.listenerCount()).toBe(3);

    api.reset();

    expect(fallback.listenerCount()).toBe(0);
    expect(fallback.reset).not.toHaveBeenCalled();
  });
});
