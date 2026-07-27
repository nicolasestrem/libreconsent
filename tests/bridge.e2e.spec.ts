import { expect, type Page, test } from "@playwright/test";

interface BridgeEvent {
  type: "ready" | "consent" | "change";
  detail: Record<string, unknown>;
}

interface BridgeState {
  source: "tcf" | "fallback";
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
  gdprApplies: boolean | null;
  observedAt: string;
}

interface BridgeReady {
  source: "tcf" | "none" | "fallback";
  consent: BridgeState | null;
}

interface BridgeSideEffects {
  bodyChildren: number;
  cookie: string;
  dataLayerExists: boolean;
  elementCount: number;
  gtagExists: boolean;
  localStorageKeys: string[];
  tcfAssignmentCount: number;
}

interface BridgeEffectEvidence {
  cookieWrites: string[];
  dataLayerAssignments: unknown[];
  dataLayerWrites: unknown[];
  gtagAssignments: string[];
  gtagCalls: unknown[];
  hostDomMutations: string[];
  localStorageClears: number;
  localStorageRemoves: string[];
  localStorageWrites: Array<[string, string]>;
  sameDataLayer: boolean;
  sameGtag: boolean;
  unexpectedDomMutations: string[];
}

interface TcfIntegrity {
  sameDescriptor: boolean;
  sameFunction: boolean;
}

declare global {
  interface Window {
    __bannerCountBeforeFallback?: number;
    __bridgeApi?: {
      getConsent(): BridgeState | null;
      reset(): void;
    };
    __bridgeDomBefore?: {
      bodyChildren: number;
      elementCount: number;
    };
    __bridgeEffects?: () => BridgeEffectEvidence;
    __bridgeEvents?: BridgeEvent[];
    __bridgeStartedAt?: number;
    __bridgeTimeoutMs?: number;
    __emitCmp?: (eventStatus: string, granted?: boolean) => void;
    __fallbackActivatedAt?: number;
    __tcfAssignmentCount?: () => number;
    __tcfCalls?: Array<{
      command: string;
      version: number;
      parameter?: number;
    }>;
    __tcfRealCalls?: Array<{
      command: string;
      version: number;
      parameter?: number;
    }>;
    __tcfIntegrity?: () => TcfIntegrity;
  }
}

function bridgeEvents(): BridgeEvent[] {
  return window.__bridgeEvents ?? [];
}

function bridgeConsent(): BridgeState | null {
  if (!window.__bridgeApi) {
    throw new Error("libreconsent bridge did not initialize");
  }
  return window.__bridgeApi.getConsent();
}

function bridgeEffectEvidence(): BridgeEffectEvidence {
  if (!window.__bridgeEffects) {
    throw new Error("bridge side-effect instrumentation is unavailable");
  }
  return window.__bridgeEffects();
}

function emitCmpUpdate({
  eventStatus,
  granted,
}: {
  eventStatus: string;
  granted: boolean;
}): void {
  if (!window.__emitCmp) {
    throw new Error("CMP fixture controls are unavailable");
  }
  window.__emitCmp(eventStatus, granted);
}

function bridgeSideEffects(): BridgeSideEffects {
  return {
    bodyChildren: document.body.children.length,
    cookie: document.cookie,
    dataLayerExists: "dataLayer" in window,
    elementCount: document.querySelectorAll("*").length,
    gtagExists: "gtag" in window,
    localStorageKeys: Object.keys(localStorage),
    tcfAssignmentCount: window.__tcfAssignmentCount?.() ?? -1,
  };
}

function fallbackTiming(): {
  activatedAt: number | undefined;
  bannerCountBeforeFallback: number | undefined;
  startedAt: number | undefined;
  timeoutMs: number | undefined;
} {
  return {
    activatedAt: window.__fallbackActivatedAt,
    bannerCountBeforeFallback: window.__bannerCountBeforeFallback,
    startedAt: window.__bridgeStartedAt,
    timeoutMs: window.__bridgeTimeoutMs,
  };
}

function tcfCalls(): Array<{
  command: string;
  version: number;
  parameter?: number;
}> {
  return window.__tcfCalls ?? [];
}

function tcfRealCalls(): Array<{
  command: string;
  version: number;
  parameter?: number;
}> {
  return window.__tcfRealCalls ?? [];
}

function tcfIntegrity(): TcfIntegrity {
  if (!window.__tcfIntegrity) {
    throw new Error("TCF integrity instrumentation is unavailable");
  }
  return window.__tcfIntegrity();
}

async function openBridge(
  page: Page,
  scenario:
    | "tcloaded"
    | "delayed"
    | "cmpuishown"
    | "none"
    | "fallback"
    | "stub-swap",
): Promise<void> {
  await page.goto(`/bridge-site/?scenario=${scenario}`);
  await page.waitForFunction(() =>
    (window.__bridgeEvents ?? []).some((event) => event.type === "ready"),
  );
}

function readyFrom(events: BridgeEvent[]): BridgeReady {
  const ready = events.find((event) => event.type === "ready");
  if (!ready) {
    throw new Error("bridge ready event was not recorded");
  }
  return ready.detail as unknown as BridgeReady;
}

test("maps tcloaded consent, then emits change for useractioncomplete (BR-2, BR-3)", async ({
  page,
}) => {
  await openBridge(page, "tcloaded");

  expect((await page.evaluate(bridgeEvents)).map(({ type }) => type)).toEqual([
    "ready",
    "consent",
  ]);
  expect(await page.evaluate(bridgeConsent)).toMatchObject({
    source: "tcf",
    categories: {
      necessary: true,
      analytics: true,
      marketing: false,
    },
    services: {},
    gdprApplies: true,
  });

  await page.evaluate(emitCmpUpdate, {
    eventStatus: "useractioncomplete",
    granted: true,
  });

  await expect
    .poll(() =>
      page
        .evaluate(bridgeEvents)
        .then((events) => events.map(({ type }) => type)),
    )
    .toEqual(["ready", "consent", "change"]);
  expect(await page.evaluate(bridgeConsent)).toMatchObject({
    source: "tcf",
    categories: {
      necessary: true,
      analytics: true,
      marketing: true,
    },
    services: {},
    gdprApplies: true,
  });
});

test("discovers a CMP installed after bridge initialization (BR-2)", async ({
  page,
}) => {
  await openBridge(page, "delayed");

  expect(readyFrom(await page.evaluate(bridgeEvents))).toMatchObject({
    source: "tcf",
    consent: {
      source: "tcf",
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
    },
  });
  expect(await page.evaluate(tcfCalls)).toContainEqual({
    command: "addEventListener",
    version: 2,
  });
});

test("treats initial cmpuishown values as transient rather than a decision (BR-2, BR-3)", async ({
  page,
}) => {
  await openBridge(page, "cmpuishown");

  expect(await page.evaluate(bridgeEvents)).toEqual([
    {
      type: "ready",
      detail: { source: "tcf", consent: null },
    },
  ]);
  expect(await page.evaluate(bridgeConsent)).toBeNull();

  await page.evaluate(emitCmpUpdate, {
    eventStatus: "useractioncomplete",
    granted: true,
  });

  await expect
    .poll(() =>
      page
        .evaluate(bridgeEvents)
        .then((events) => events.map(({ type }) => type)),
    )
    .toEqual(["ready", "consent"]);
  expect(await page.evaluate(bridgeConsent)).toMatchObject({
    categories: { analytics: true, marketing: true },
  });
});

test("reports source none when no CMP appears before the deadline (BR-4)", async ({
  page,
}) => {
  await openBridge(page, "none");

  expect(await page.evaluate(bridgeEvents)).toEqual([
    {
      type: "ready",
      detail: { source: "none", consent: null },
    },
  ]);
  expect(await page.evaluate(bridgeConsent)).toBeNull();
});

test("hands off to real core/UI only after the timeout and renders one banner (BR-4)", async ({
  page,
}) => {
  await openBridge(page, "fallback");

  const timing = await page.evaluate(fallbackTiming);
  expect(timing.bannerCountBeforeFallback).toBe(0);
  expect(timing.startedAt).toBeDefined();
  expect(timing.activatedAt).toBeDefined();
  expect(timing.timeoutMs).toBe(250);
  expect(
    (timing.activatedAt ?? 0) - (timing.startedAt ?? 0),
  ).toBeGreaterThanOrEqual(250);

  const events = await page.evaluate(bridgeEvents);
  expect(readyFrom(events)).toEqual({ source: "fallback", consent: null });
  expect(
    events.some(
      (event) =>
        event.type === "ready" &&
        (event.detail as unknown as BridgeReady).source === "none",
    ),
  ).toBe(false);
  await expect(page.locator("[data-libreconsent-ui]")).toHaveCount(1);
  await expect(page.locator("[data-lc-banner]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
  expect(await page.evaluate(bridgeConsent)).toBeNull();
  expect(await page.evaluate(bridgeSideEffects)).toMatchObject({
    cookie: "",
    dataLayerExists: true,
    gtagExists: true,
    localStorageKeys: [],
    tcfAssignmentCount: 0,
  });
});

test("adds no DOM, storage, Google signals, network, TC strings, or TCF assignment (BR-1)", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    requested.push(new URL(request.url()).pathname);
  });

  await openBridge(page, "tcloaded");

  await page.evaluate(emitCmpUpdate, {
    eventStatus: "useractioncomplete",
    granted: true,
  });
  await expect
    .poll(() =>
      page
        .evaluate(bridgeEvents)
        .then((events) => events.map(({ type }) => type)),
    )
    .toEqual(["ready", "consent", "change"]);

  const before = await page.evaluate(() => window.__bridgeDomBefore);
  const after = await page.evaluate(bridgeSideEffects);
  expect(after).toMatchObject({
    bodyChildren: before?.bodyChildren,
    cookie: "",
    dataLayerExists: true,
    elementCount: before?.elementCount,
    gtagExists: true,
    localStorageKeys: [],
    tcfAssignmentCount: 1,
  });
  const evidence = await page.evaluate(bridgeEffectEvidence);
  expect(evidence.hostDomMutations).toEqual([
    'script[src="/dist/bridge.global.js"]',
    "script",
    "text",
  ]);
  expect(evidence).toMatchObject({
    cookieWrites: [],
    dataLayerAssignments: [],
    dataLayerWrites: [],
    gtagAssignments: [],
    gtagCalls: [],
    localStorageClears: 0,
    localStorageRemoves: [],
    localStorageWrites: [],
    sameDataLayer: true,
    sameGtag: true,
    unexpectedDomMutations: [],
  });
  expect(requested.sort()).toEqual(
    ["/bridge-site/", "/dist/bridge.global.js"].sort(),
  );

  const exposed = JSON.stringify({
    events: await page.evaluate(bridgeEvents),
    consent: await page.evaluate(bridgeConsent),
  });
  expect(exposed).not.toContain("fixture-tc-string-must-not-leak");
  expect(exposed).not.toContain("tcString");
  expect(await page.evaluate(bridgeConsent)).not.toHaveProperty("consentId");
  expect(await page.evaluate(bridgeConsent)).not.toHaveProperty("createdAt");
  expect(await page.evaluate(bridgeConsent)).not.toHaveProperty("updatedAt");
  expect(await page.evaluate(bridgeConsent)).not.toHaveProperty("revision");
});

test("teardown removes the external CMP listener without replacing __tcfapi (BR-1)", async ({
  page,
}) => {
  await openBridge(page, "tcloaded");

  expect(await page.evaluate(tcfIntegrity)).toEqual({
    sameDescriptor: true,
    sameFunction: true,
  });
  await page.evaluate(() => window.__bridgeApi?.reset());

  expect(await page.evaluate(tcfCalls)).toContainEqual({
    command: "removeEventListener",
    version: 2,
    parameter: 73,
  });
  expect((await page.evaluate(bridgeSideEffects)).tcfAssignmentCount).toBe(1);
  expect(await page.evaluate(tcfIntegrity)).toEqual({
    sameDescriptor: true,
    sameFunction: true,
  });
});

test("teardown removes a queued listener through the replacement CMP provider (BR-1)", async ({
  page,
}) => {
  await openBridge(page, "stub-swap");

  await page.evaluate(() => window.__bridgeApi?.reset());

  await expect
    .poll(() => page.evaluate(tcfRealCalls))
    .toContainEqual({
      command: "removeEventListener",
      version: 2,
      parameter: 73,
    });
  expect((await page.evaluate(bridgeSideEffects)).tcfAssignmentCount).toBe(2);
});
