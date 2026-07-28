// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type CmpConfig,
  type ConsentApi,
  ConsentError,
  type ConsentState,
  en,
  fr,
  type GoogleSignal,
  init,
  type ReadyEvent,
} from "./index";

const DAY = 24 * 60 * 60 * 1000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const dictionary = {
  "category.analytics.label": "Analytics",
  "category.analytics.description": "Analytics description",
  "category.marketing.label": "Marketing",
  "category.marketing.description": "Marketing description",
  "category.functional.label": "Functional",
  "category.functional.description": "Functional description",
  "service.ga.label": "Google Analytics",
  "service.amp.label": "Amplitude",
  "service.ads.label": "Advertising",
  "service.regional.label": "Regional service",
  "cookie.ga.purpose": "Measure site usage",
  "cookie.ga.provider": "Google",
  "cookie.ga.duration": "Two years",
  "cookie.ga.type": "HTTP cookie",
};

function baseConfig(overrides: Partial<CmpConfig> = {}): CmpConfig {
  return {
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
        services: [
          {
            id: "ga",
            label: "service.ga.label",
            cookies: [
              {
                name: "_ga",
                purpose: "cookie.ga.purpose",
                provider: "cookie.ga.provider",
                duration: "cookie.ga.duration",
                type: "cookie.ga.type",
              },
            ],
          },
          {
            id: "amp",
            label: "service.amp.label",
          },
        ],
      },
      {
        id: "marketing",
        label: "category.marketing.label",
        description: "category.marketing.description",
        services: [{ id: "ads", label: "service.ads.label" }],
      },
    ],
    i18n: {
      default: "en",
      translations: { en: dictionary },
    },
    ...overrides,
  };
}

function storedState(overrides: Partial<ConsentState> = {}): ConsentState {
  const timestamp = new Date().toISOString();
  return {
    consentId: "9d235664-2d3d-4db5-8117-36c0ac57e920",
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    categories: {
      necessary: true,
      analytics: true,
      marketing: false,
    },
    services: {
      ga: true,
      amp: false,
      ads: false,
    },
    ...overrides,
  };
}

function encodeState(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

function setDocumentCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the storage contract under test is cookie-based
  document.cookie = value;
}

const activeApis = new Set<ConsentApi>();

function start(config: CmpConfig): ConsentApi {
  const api = init(config);
  activeApis.add(api);
  return api;
}

function waitForReady(api: ConsentApi): Promise<ReadyEvent> {
  return new Promise((resolve) => {
    api.on("ready", resolve);
  });
}

function expectConsentError(
  operation: () => unknown,
  code: "INVALID_CONFIG" | "INVALID_SELECTION",
  path: string,
): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConsentError);
    expect(error).toMatchObject({ code, path });
    expect((error as Error).message).toContain(path);
    return;
  }
  throw new Error(`Expected ${code} at ${path}`);
}

function clearAllCookies(): void {
  for (const cookie of document.cookie.split(";")) {
    const separator = cookie.indexOf("=");
    const name = (
      separator === -1 ? cookie : cookie.slice(0, separator)
    ).trim();
    if (name) {
      setDocumentCookie(
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      );
    }
  }
}

afterEach(() => {
  for (const api of activeApis) {
    api.reset();
  }
  activeApis.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  clearAllCookies();
  document.body.replaceChildren();
  Reflect.deleteProperty(navigator, "globalPrivacyControl");
  delete (window as typeof window & { gtag?: unknown }).gtag;
  delete (window as typeof window & { dataLayer?: unknown }).dataLayer;
  vi.unstubAllGlobals();
});

describe("configuration (CFG-1..7)", () => {
  test("normalizes defaults, injects necessary first, and deeply freezes getConfig", async () => {
    const api = start(baseConfig());
    await waitForReady(api);

    const config = api.getConfig();
    expect(config.categories.map(({ id }) => id)).toEqual([
      "necessary",
      "analytics",
      "marketing",
    ]);
    expect(config.categories[0]).toMatchObject({
      id: "necessary",
      readonly: true,
      enabled: true,
      services: [],
    });
    expect(config.categories[1]).toMatchObject({
      readonly: false,
      enabled: false,
    });
    expect(config.storage).toEqual({
      cookieName: "libreconsent",
      expiresDays: 365,
      sameSite: "Lax",
    });
    expect(config.revision).toBe(1);
    expect(config.consentMode).toEqual({
      enabled: false,
      mapping: {
        analytics_storage: "analytics",
        ad_storage: "marketing",
        ad_user_data: "marketing",
        ad_personalization: "marketing",
      },
      defaults: "denied-everywhere",
      waitForUpdate: 500,
      adsDataRedaction: false,
      urlPassthrough: false,
    });
    expect(config.i18n.default).toBe("en");
    expect(config.i18n.autoDetect).toBe(false);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.categories)).toBe(true);
    expect(Object.isFrozen(config.categories[1]?.services[0]?.cookies[0])).toBe(
      true,
    );
    expect(() => {
      config.storage.expiresDays = 1;
    }).toThrow(TypeError);
  });

  test.each([
    {
      configured: "  /api/consent-receipt?source=cmp  ",
      normalized: "/api/consent-receipt?source=cmp",
      form: "relative",
    },
    {
      configured: " https://receipts.example.com/receipt ",
      normalized: "https://receipts.example.com/receipt",
      form: "absolute",
    },
  ])(
    "normalizes and freezes an optional complete $form receipt endpoint (LOG-4)",
    async ({ configured, normalized }) => {
      const api = start(baseConfig({ receiptEndpoint: configured }));
      await waitForReady(api);

      expect(api.getConfig().receiptEndpoint).toBe(normalized);
      expect(Object.isFrozen(api.getConfig())).toBe(true);
    },
  );

  test.each([
    { endpoint: "", label: "empty" },
    { endpoint: "   ", label: "whitespace-only" },
    { endpoint: "http://", label: "malformed" },
    { endpoint: "mailto:audit@example.com", label: "unsupported protocol" },
    { endpoint: 42, label: "non-string" },
  ])("rejects a $label receipt endpoint (LOG-4)", ({ endpoint }) => {
    expectConsentError(
      () =>
        start(
          baseConfig({
            receiptEndpoint: endpoint as string,
          }),
        ),
      "INVALID_CONFIG",
      "receiptEndpoint",
    );
  });

  test("moves a configured necessary category first and forces its invariants", async () => {
    const config = baseConfig();
    config.categories.push({
      id: "necessary",
      label: "category.necessary.label",
      description: "category.necessary.description",
    });
    const api = start(config);
    await waitForReady(api);

    expect(api.getConfig().categories[0]).toMatchObject({
      id: "necessary",
      readonly: true,
      enabled: true,
    });
  });

  test("normalizes cookie rows, storage, consent settings, and region lists", async () => {
    const api = start(
      baseConfig({
        storage: {
          cookieName: "cmp-decision",
          domain: ".example.test",
          expiresDays: 90,
          sameSite: "Strict",
        },
        revision: 3,
        consentMode: {
          enabled: true,
          mapping: { analytics_storage: "marketing" },
          defaults: { deniedRegions: ["fr", "US"] },
          waitForUpdate: 750,
          adsDataRedaction: true,
          urlPassthrough: true,
        },
      }),
    );
    await waitForReady(api);

    const config = api.getConfig();
    expect(config.storage).toEqual({
      cookieName: "cmp-decision",
      domain: ".example.test",
      expiresDays: 90,
      sameSite: "Strict",
    });
    expect(config.revision).toBe(3);
    expect(config.consentMode).toMatchObject({
      enabled: true,
      defaults: { deniedRegions: ["FR", "US"] },
      waitForUpdate: 750,
      adsDataRedaction: true,
      urlPassthrough: true,
    });
    expect(config.consentMode.mapping.analytics_storage).toBe("marketing");
    expect(config.categories[1]?.services[0]?.cookies[0]).toEqual({
      name: "_ga",
      purpose: "cookie.ga.purpose",
      provider: "cookie.ga.provider",
      duration: "cookie.ga.duration",
      type: "cookie.ga.type",
    });
  });

  test("readonly categories default enabled while optional categories cannot start enabled", async () => {
    const config = baseConfig();
    config.categories.push({
      id: "functional",
      label: "category.functional.label",
      description: "category.functional.description",
      readonly: true,
    });
    const api = start(config);
    await waitForReady(api);

    expect(
      api.getConfig().categories.find(({ id }) => id === "functional"),
    ).toMatchObject({ readonly: true, enabled: true });

    expectConsentError(
      () =>
        start(
          baseConfig({
            categories: [
              {
                id: "analytics",
                label: "category.analytics.label",
                description: "category.analytics.description",
                enabled: true,
              },
            ],
          }),
        ),
      "INVALID_CONFIG",
      "categories[0].enabled",
    );
  });

  test.each([
    {
      name: "malformed category id",
      config: {
        categories: [
          {
            id: "necessary",
            label: "category.necessary.label",
            description: "category.necessary.description",
          },
          {
            id: "",
            label: "category.analytics.label",
            description: "category.analytics.description",
          },
        ],
      },
      path: "categories[1].id",
    },
    {
      name: "disabled necessary category",
      config: {
        categories: [
          {
            id: "necessary",
            label: "category.necessary.label",
            description: "category.necessary.description",
            enabled: false,
          },
        ],
      },
      path: "categories[0].enabled",
    },
    {
      name: "invalid cookie purpose",
      config: {
        categories: [
          {
            id: "analytics",
            label: "category.analytics.label",
            description: "category.analytics.description",
            services: [
              {
                id: "ga",
                label: "service.ga.label",
                cookies: [{ name: "_ga", purpose: "" }],
              },
            ],
          },
        ],
      },
      path: "categories[0].services[0].cookies[0].purpose",
    },
    {
      name: "invalid expiry",
      config: { ...baseConfig(), storage: { expiresDays: 396 } },
      path: "storage.expiresDays",
    },
    {
      name: "invalid revision",
      config: { ...baseConfig(), revision: 0 },
      path: "revision",
    },
    {
      name: "invalid wait time",
      config: {
        ...baseConfig(),
        consentMode: { waitForUpdate: -1 },
      },
      path: "consentMode.waitForUpdate",
    },
    {
      name: "unknown mapping category",
      config: {
        ...baseConfig(),
        consentMode: { mapping: { ad_storage: "missing" } },
      },
      path: "consentMode.mapping.ad_storage",
    },
  ])("throws a typed synchronous error for $name", ({ config, path }) => {
    expectConsentError(
      () => start(config as CmpConfig),
      "INVALID_CONFIG",
      path,
    );
  });

  test("rejects duplicate category IDs and globally duplicate service IDs", () => {
    const duplicateCategory = baseConfig();
    duplicateCategory.categories.push({
      id: "analytics",
      label: "category.analytics.label",
      description: "category.analytics.description",
    });
    expectConsentError(
      () => start(duplicateCategory),
      "INVALID_CONFIG",
      "categories[2].id",
    );

    const duplicateService = baseConfig();
    duplicateService.categories[1]?.services?.push({
      id: "ga",
      label: "service.ga.label",
    });
    expectConsentError(
      () => start(duplicateService),
      "INVALID_CONFIG",
      "categories[1].services[1].id",
    );
  });

  test("rejects duplicate regions after case normalization", () => {
    const config = baseConfig();
    config.categories[0]?.services?.push({
      id: "regional",
      label: "service.regional.label",
      onlyRegions: ["fr", "FR"],
    });
    expectConsentError(
      () => start(config),
      "INVALID_CONFIG",
      "categories[0].services[2].onlyRegions[1]",
    );
  });

  test("ships EN and FR dictionaries and falls partial secondary locales back to default", async () => {
    expect(en["ui.acceptAll"]).toBe("Accept all");
    expect(fr["ui.acceptAll"]).toBe("Tout accepter");

    const config = baseConfig({
      i18n: {
        default: "en",
        autoDetect: true,
        translations: {
          en: dictionary,
          de: { "category.analytics.label": "Analyse" },
        },
      },
    });
    const api = start(config);
    await waitForReady(api);

    expect(api.getConfig().i18n.autoDetect).toBe(true);
    expect(
      api.getConfig().i18n.translations.de?.["category.analytics.label"],
    ).toBe("Analyse");
    expect(api.getConfig().i18n.translations.de?.["service.ga.label"]).toBe(
      "Google Analytics",
    );
    expect(api.getConfig().i18n.translations.fr?.["ui.acceptAll"]).toBe(
      "Tout accepter",
    );
  });

  test("requires every referenced prose key in the default dictionary", () => {
    const config = baseConfig({
      i18n: {
        default: "en",
        translations: {
          en: {
            ...dictionary,
            "service.ga.label": undefined,
          } as unknown as Record<string, string>,
        },
      },
    });
    expectConsentError(
      () => start(config),
      "INVALID_CONFIG",
      "i18n.translations.en.service.ga.label",
    );
  });

  test("validates every effective mapping target when Consent Mode is enabled", () => {
    const config = baseConfig({
      categories: [
        {
          id: "analytics",
          label: "category.analytics.label",
          description: "category.analytics.description",
        },
      ],
      consentMode: { enabled: true },
    });

    expectConsentError(
      () => start(config),
      "INVALID_CONFIG",
      "consentMode.mapping.ad_storage",
    );
  });

  test("rejects unknown Consent Mode signal keys", () => {
    const config = baseConfig({
      consentMode: {
        enabled: true,
        mapping: {
          analytics_storage: "analytics",
          unknown_storage: "analytics",
        } as unknown as Partial<Record<GoogleSignal, string>>,
      },
    });

    expectConsentError(
      () => start(config),
      "INVALID_CONFIG",
      "consentMode.mapping.unknown_storage",
    );
  });
});

describe("Consent Mode validation and lifecycle signaling (CM-2, CM-3)", () => {
  test.each([0, -1, 1.5])("requires a positive waitForUpdate (%s)", (value) => {
    expectConsentError(
      () =>
        start(
          baseConfig({ consentMode: { enabled: true, waitForUpdate: value } }),
        ),
      "INVALID_CONFIG",
      "consentMode.waitForUpdate",
    );
  });

  test("keeps disabled Consent Mode side-effect-free", async () => {
    const gtag = vi.fn();
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    const api = start(baseConfig({ consentMode: { enabled: false } }));

    await waitForReady(api);
    api.acceptAll();

    expect(gtag).not.toHaveBeenCalled();
  });

  test("maps all four signals for first partial, changed, rejected, and withdrawn consent", async () => {
    const gtag = vi.fn();
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    const api = start(baseConfig({ consentMode: { enabled: true } }));
    await waitForReady(api);

    api.setConsent({ services: { ga: true } });
    api.acceptAll();
    api.rejectAll();
    api.withdraw();

    expect(gtag.mock.calls).toEqual([
      [
        "consent",
        "update",
        {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ],
      [
        "consent",
        "update",
        {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        },
      ],
      [
        "consent",
        "update",
        {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ],
      [
        "consent",
        "update",
        {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ],
    ]);
  });

  test("signals restored and queued decisions with custom category mappings", async () => {
    const restored = storedState({
      categories: { necessary: true, analytics: false, marketing: true },
      services: { ga: false, amp: false, ads: true },
    });
    window.localStorage.setItem("libreconsent", encodeState(restored));
    const gtag = vi.fn();
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    const restoredApi = start(
      baseConfig({
        consentMode: {
          enabled: true,
          mapping: {
            analytics_storage: "marketing",
            ad_storage: "analytics",
            ad_user_data: "analytics",
            ad_personalization: "marketing",
          },
        },
      }),
    );
    await waitForReady(restoredApi);

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "granted",
    });

    restoredApi.reset();
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const queuedApi = start(
      baseConfig({
        consentMode: { enabled: true },
        resolveRegion: () => pendingRegion,
      }),
    );
    queuedApi.rejectAll();
    resolveRegion?.("FR");
    await waitForReady(queuedApi);

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  test("isolates missing and throwing Google tag globals from consent persistence", async () => {
    const api = start(baseConfig({ consentMode: { enabled: true } }));
    await waitForReady(api);
    expect(() => api.acceptAll()).not.toThrow();
    expect(api.getConsent()?.categories.analytics).toBe(true);

    api.reset();
    const gtag = vi.fn(() => {
      throw new Error("tag unavailable");
    });
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    const failingApi = start(baseConfig({ consentMode: { enabled: true } }));
    await waitForReady(failingApi);
    expect(() => failingApi.rejectAll()).not.toThrow();
    expect(failingApi.getConsent()?.categories.analytics).toBe(false);
  });
});

describe("initialization, region resolution, and singleton behavior (CFG-9, CORE-1)", () => {
  test("returns the same singleton for the same normalized configuration", () => {
    const first = start(baseConfig());
    const second = start(baseConfig());

    expect(second).toBe(first);
  });

  test("includes resolver function identity in singleton compatibility", () => {
    const resolver = async () => "fr";
    const first = start(baseConfig({ resolveRegion: resolver }));

    expect(start(baseConfig({ resolveRegion: resolver }))).toBe(first);
    expectConsentError(
      () => start(baseConfig({ resolveRegion: async () => "fr" })),
      "INVALID_CONFIG",
      "config",
    );
  });

  test("throws synchronously when a repeated init is materially different", () => {
    start(baseConfig());

    expectConsentError(
      () => start(baseConfig({ revision: 2 })),
      "INVALID_CONFIG",
      "config",
    );
  });

  test("includes the normalized receipt endpoint in singleton compatibility (LOG-4)", () => {
    const first = start(baseConfig({ receiptEndpoint: " /audit/receipt " }));

    expect(start(baseConfig({ receiptEndpoint: "/audit/receipt" }))).toBe(
      first,
    );
    expectConsentError(
      () => start(baseConfig({ receiptEndpoint: "/audit/other" })),
      "INVALID_CONFIG",
      "config",
    );
  });

  test("treats dictionary key insertion order as semantically identical", () => {
    const first = start(baseConfig());
    const reversedDictionary = Object.fromEntries(
      Object.entries(dictionary).reverse(),
    );
    const second = start(
      baseConfig({
        i18n: {
          default: "en",
          translations: { en: reversedDictionary },
        },
      }),
    );

    expect(second).toBe(first);
  });

  test("awaits region resolution, normalizes it, and applies matching services", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const config = baseConfig({ resolveRegion: () => pendingRegion });
    config.categories[0]?.services?.push({
      id: "regional",
      label: "service.regional.label",
      onlyRegions: ["fr"],
    });
    const api = start(config);
    const ready = vi.fn();
    api.on("ready", ready);
    api.acceptAll();

    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();

    resolveRegion?.("fr");
    await waitForReady(api);
    expect(api.getConsent()).toMatchObject({
      region: "FR",
      services: { regional: true },
    });
    expect(api.getConfig().categories[1]?.services[2]?.onlyRegions).toEqual([
      "FR",
    ]);
  });

  test.each([
    {
      name: "null",
      resolveRegion: async () => null,
    },
    {
      name: "rejection",
      resolveRegion: async () => {
        throw new Error("offline");
      },
    },
    {
      name: "outside configured regions",
      resolveRegion: async () => "DE",
    },
  ])(
    "uses strict behavior for $name region resolution",
    async ({ resolveRegion }) => {
      const config = baseConfig({ resolveRegion });
      config.categories[0]?.services?.push({
        id: "regional",
        label: "service.regional.label",
        onlyRegions: ["FR"],
      });
      const api = start(config);
      api.acceptAll();
      await waitForReady(api);

      expect(api.getConsent()?.services.regional).toBe(false);
    },
  );

  test("reports the uppercased resolved region on ready before any decision", async () => {
    const api = start(baseConfig({ resolveRegion: async () => " fr " }));

    const ready = await waitForReady(api);

    expect(ready.region).toBe("FR");
    expect(ready.consent).toBeNull();
  });

  test.each([
    { name: "no resolver", resolveRegion: undefined },
    { name: "null resolution", resolveRegion: async () => null },
    {
      name: "rejected resolution",
      resolveRegion: async () => {
        throw new Error("offline");
      },
    },
  ])("reports a null ready region for $name", async ({ resolveRegion }) => {
    const api = start(
      resolveRegion ? baseConfig({ resolveRegion }) : baseConfig(),
    );

    const ready = await waitForReady(api);

    expect(ready.region).toBeNull();
  });
});

describe("consent lifecycle and invariants (CORE-2..4, CORE-6..7, CORE-10)", () => {
  test("keeps getConsent active-only and creates a UUIDv4 state on first decision", async () => {
    const api = start(baseConfig());
    expect(api.getConsent()).toBeNull();
    await waitForReady(api);
    expect(api.getConsent()).toBeNull();

    expect(api.rejectAll()).toBeUndefined();
    const state = api.getConsent();
    expect(state?.consentId).toMatch(UUID_V4);
    expect(state?.createdAt).toMatch(/Z$/);
    expect(state?.updatedAt).toMatch(/Z$/);
    expect(state?.revision).toBe(1);
    expect(state?.categories).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  test("uses getRandomValues for UUIDv4 when crypto.randomUUID is unavailable", async () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index;
      }
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const api = start(baseConfig());
    await waitForReady(api);

    api.rejectAll();

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(api.getConsent()?.consentId).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
    expect(api.getConsent()?.consentId).toMatch(UUID_V4);
  });

  test("applies category changes before service overrides and recomputes categories", async () => {
    const api = start(baseConfig());
    await waitForReady(api);

    expect(
      api.setConsent({
        categories: { analytics: true, marketing: true },
        services: { ga: false, ads: false },
      }),
    ).toBeUndefined();
    expect(api.getConsent()).toMatchObject({
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
      services: {
        ga: false,
        amp: true,
        ads: false,
      },
    });

    api.setConsent({ services: { amp: false } });
    expect(api.getConsent()?.categories.analytics).toBe(false);
  });

  test("acceptAll and rejectAll affect every optional choice but never necessary", async () => {
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    expect(api.getConsent()).toMatchObject({
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
      services: { ga: true, amp: true, ads: true },
    });

    api.rejectAll();
    expect(api.getConsent()).toMatchObject({
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
      services: { ga: false, amp: false, ads: false },
    });
  });

  test("supports service-less category choices", async () => {
    const config = baseConfig();
    config.categories.push({
      id: "functional",
      label: "category.functional.label",
      description: "category.functional.description",
    });
    const api = start(config);
    await waitForReady(api);

    api.setConsent({ categories: { functional: true } });
    expect(api.getConsent()?.categories.functional).toBe(true);
    api.rejectAll();
    expect(api.getConsent()?.categories.functional).toBe(false);
  });

  test("preserves enabled readonly categories and rejects attempts to change them", async () => {
    const config = baseConfig();
    config.categories.push({
      id: "functional",
      label: "category.functional.label",
      description: "category.functional.description",
      readonly: true,
      services: [{ id: "regional", label: "service.regional.label" }],
    });
    const api = start(config);
    await waitForReady(api);

    api.rejectAll();
    expect(api.getConsent()).toMatchObject({
      categories: { necessary: true, functional: true },
      services: { regional: true },
    });
    expectConsentError(
      () => api.setConsent({ categories: { necessary: false } }),
      "INVALID_SELECTION",
      "selection.categories.necessary",
    );
    expectConsentError(
      () => api.setConsent({ categories: { functional: false } }),
      "INVALID_SELECTION",
      "selection.categories.functional",
    );
    expectConsentError(
      () => api.setConsent({ services: { regional: false } }),
      "INVALID_SELECTION",
      "selection.services.regional",
    );
  });

  test("safely persists __proto__ category and service IDs as own boolean choices", async () => {
    const config = baseConfig({
      categories: [
        {
          id: "__proto__",
          label: "category.functional.label",
          description: "category.functional.description",
        },
        {
          id: "analytics",
          label: "category.analytics.label",
          description: "category.analytics.description",
          services: [{ id: "__proto__", label: "service.ga.label" }],
        },
      ],
    });
    const api = start(config);
    await waitForReady(api);

    api.acceptAll();
    const state = api.getConsent();
    expect(
      Object.getOwnPropertyDescriptor(state?.categories ?? {}, "__proto__"),
    ).toMatchObject({ value: true });
    expect(
      Object.getOwnPropertyDescriptor(state?.services ?? {}, "__proto__"),
    ).toMatchObject({ value: true });

    const encoded = window.localStorage.getItem("libreconsent");
    const persisted = JSON.parse(decodeURIComponent(encoded ?? "")) as {
      categories: Record<string, boolean>;
      services: Record<string, boolean>;
    };
    expect(
      Object.getOwnPropertyDescriptor(persisted.categories, "__proto__"),
    ).toMatchObject({ value: true });
    expect(
      Object.getOwnPropertyDescriptor(persisted.services, "__proto__"),
    ).toMatchObject({ value: true });
  });

  test.each([
    {
      selection: { categories: { missing: true } },
      path: "selection.categories.missing",
    },
    {
      selection: { services: { missing: true } },
      path: "selection.services.missing",
    },
    {
      selection: { categories: { analytics: "yes" } },
      path: "selection.categories.analytics",
    },
  ])("rejects invalid selections at $path", async ({ selection, path }) => {
    const api = start(baseConfig());
    await waitForReady(api);

    expectConsentError(
      () =>
        api.setConsent(
          selection as unknown as Parameters<ConsentApi["setConsent"]>[0],
        ),
      "INVALID_SELECTION",
      path,
    );
    expect(api.getConsent()).toBeNull();
  });

  test("returns defensive state copies", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();

    const copy = api.getConsent();
    if (!copy) {
      throw new Error("Expected active consent");
    }
    copy.categories.analytics = false;
    copy.services.ga = false;

    expect(api.getConsent()).toMatchObject({
      categories: { analytics: true },
      services: { ga: true },
    });
  });

  test("preserves consent ID and createdAt across changes and withdrawal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T10:00:00.000Z"));
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();
    const first = api.getConsent();

    vi.setSystemTime(new Date("2026-07-26T11:00:00.000Z"));
    api.setConsent({ services: { ga: false } });
    const changed = api.getConsent();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    expect(api.withdraw()).toBeUndefined();
    const withdrawn = api.getConsent();

    expect(changed?.consentId).toBe(first?.consentId);
    expect(changed?.createdAt).toBe(first?.createdAt);
    expect(changed?.updatedAt).toBe("2026-07-26T11:00:00.000Z");
    expect(withdrawn?.consentId).toBe(first?.consentId);
    expect(withdrawn?.createdAt).toBe(first?.createdAt);
    expect(withdrawn?.updatedAt).toBe("2026-07-26T12:00:00.000Z");
    expect(withdrawn).toMatchObject({
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
      services: { ga: false, amp: false, ads: false },
    });
  });

  test("keeps UI intents DOM-safe when no renderer is registered", async () => {
    document.body.innerHTML = "<main>Site</main>";
    const api = start(baseConfig());
    await waitForReady(api);

    expect(api.showPreferences()).toBeUndefined();
    expect(api.hide()).toBeUndefined();
    expect(document.body.innerHTML).toBe("<main>Site</main>");
  });

  test("forwards UI intents to a registered renderer until it unregisters", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const renderer = { showPreferences: vi.fn(), hide: vi.fn() };

    const unregister = api.registerRenderer(renderer);
    api.showPreferences();
    api.hide();

    expect(renderer.showPreferences).toHaveBeenCalledOnce();
    expect(renderer.hide).toHaveBeenCalledOnce();

    unregister();
    api.showPreferences();
    api.hide();

    expect(renderer.showPreferences).toHaveBeenCalledOnce();
    expect(renderer.hide).toHaveBeenCalledOnce();
  });

  test("replaces an earlier renderer and ignores its stale unregister", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const first = { showPreferences: vi.fn(), hide: vi.fn() };
    const second = { showPreferences: vi.fn(), hide: vi.fn() };

    const unregisterFirst = api.registerRenderer(first);
    api.registerRenderer(second);
    unregisterFirst();
    api.showPreferences();

    expect(first.showPreferences).not.toHaveBeenCalled();
    expect(second.showPreferences).toHaveBeenCalledOnce();
  });

  test("isolates renderer failures from the caller", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.registerRenderer({
      showPreferences: () => {
        throw new Error("renderer failed");
      },
      hide: () => {
        throw new Error("renderer failed");
      },
    });

    expect(() => api.showPreferences()).not.toThrow();
    expect(() => api.hide()).not.toThrow();
  });

  test("drops the renderer on reset", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const renderer = { showPreferences: vi.fn(), hide: vi.fn() };
    api.registerRenderer(renderer);

    api.reset();
    api.showPreferences();

    expect(renderer.showPreferences).not.toHaveBeenCalled();
  });
});

describe("events and queued decisions (CORE-3)", () => {
  test("emits ready before first consent and change only for later decisions", async () => {
    const api = start(baseConfig());
    const events: string[] = [];
    api.on("ready", () => events.push("ready"));
    api.on("consent", () => events.push("consent"));
    api.on("change", () => events.push("change"));

    await waitForReady(api);
    api.acceptAll();
    api.rejectAll();

    expect(events).toEqual(["ready", "consent", "change"]);
  });

  test("emits ready before consent when restoring an active decision", async () => {
    const state = storedState();
    setDocumentCookie(`libreconsent=${encodeState(state)}; Path=/`);
    const api = start(baseConfig());
    const events: string[] = [];
    api.on("ready", () => events.push("ready"));
    api.on("consent", () => events.push("consent"));

    await waitForReady(api);

    expect(events).toEqual(["ready", "consent"]);
    expect(api.getConsent()?.consentId).toBe(state.consentId);
  });

  test("replays ready and current consent to late subscribers but never change", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();
    api.rejectAll();

    const ready = vi.fn();
    const consent = vi.fn();
    const change = vi.fn();
    api.on("ready", ready);
    api.on("consent", consent);
    api.on("change", change);

    expect(ready).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "new", consent: null }),
    );
    expect(consent).toHaveBeenCalledOnce();
    expect(consent).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: expect.objectContaining({ analytics: false }),
      }),
    );
    expect(change).not.toHaveBeenCalled();
  });

  test("isolates errors from late ready replay callbacks", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const replay = vi.fn(() => {
      throw new Error("late ready listener failed");
    });

    let unsubscribe: (() => void) | undefined;
    expect(() => {
      unsubscribe = api.on("ready", replay);
    }).not.toThrow();

    expect(replay).toHaveBeenCalledOnce();
    expect(unsubscribe).toBeTypeOf("function");
    unsubscribe?.();
  });

  test("isolates errors from late consent replay callbacks", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();
    const replay = vi.fn(() => {
      throw new Error("late consent listener failed");
    });

    let unsubscribe: (() => void) | undefined;
    expect(() => {
      unsubscribe = api.on("consent", replay);
    }).not.toThrow();

    expect(replay).toHaveBeenCalledOnce();
    expect(unsubscribe).toBeTypeOf("function");
    unsubscribe?.();
  });

  test("supports unsubscribe and off", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = api.on("change", first);
    api.on("change", second);

    api.acceptAll();
    unsubscribe();
    api.off("change", second);
    api.rejectAll();

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  test("invokes ready listeners in subscription order", async () => {
    const api = start(baseConfig());
    const order: string[] = [];
    api.on("ready", () => order.push("first"));
    api.on("ready", () => order.push("second"));
    api.on("ready", () => order.push("third"));

    await waitForReady(api);

    expect(order).toEqual(["first", "second", "third"]);
  });

  test("isolates throwing listeners so queued decisions still initialize in FIFO order", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const api = start(baseConfig({ resolveRegion: () => pendingRegion }));
    const events: string[] = [];
    api.on("consent", () => {
      events.push("throwing-consent");
      throw new Error("listener failed");
    });
    api.on("consent", () => events.push("later-consent"));
    api.on("change", (state) =>
      events.push(`change:${String(state.categories.analytics)}`),
    );
    const ready = waitForReady(api);

    api.acceptAll();
    api.rejectAll();
    resolveRegion?.("FR");
    await ready;
    await Promise.resolve();

    expect(events).toEqual([
      "throwing-consent",
      "later-consent",
      "change:false",
    ]);
    expect(api.getConsent()?.categories.analytics).toBe(false);
  });

  test("delivers reentrant decisions to every listener in FIFO order", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const observed: string[] = [];

    api.on("consent", () => api.rejectAll());
    api.on("consent", (state) =>
      observed.push(`consent:${String(state.categories.analytics)}`),
    );
    api.on("change", (state) => {
      if (!state.categories.analytics) {
        api.acceptAll();
      }
    });
    api.on("change", (state) =>
      observed.push(`change:${String(state.categories.analytics)}`),
    );

    api.acceptAll();

    expect(observed).toEqual(["consent:true", "change:false", "change:true"]);
    expect(api.getConsent()?.categories.analytics).toBe(true);
  });

  test("queues pre-initialization decisions in call order", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const api = start(baseConfig({ resolveRegion: () => pendingRegion }));
    const events: string[] = [];
    api.on("ready", () => events.push("ready"));
    api.on("consent", () => events.push("consent"));
    api.on("change", () => events.push("change"));
    const ready = waitForReady(api);

    api.acceptAll();
    api.rejectAll();
    api.setConsent({ services: { ga: true } });
    expect(api.getConsent()).toBeNull();

    resolveRegion?.("US");
    await ready;

    expect(events).toEqual(["ready", "consent", "change", "change"]);
    expect(api.getConsent()).toMatchObject({
      region: "US",
      categories: { analytics: true, marketing: false },
      services: { ga: true, amp: false, ads: false },
    });
  });

  test("clones queued selection input at call time", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const api = start(baseConfig({ resolveRegion: () => pendingRegion }));
    const selection = {
      categories: { analytics: true },
      services: { ga: true },
    };
    const ready = waitForReady(api);

    api.setConsent(selection);
    selection.categories.analytics = false;
    selection.services.ga = false;
    resolveRegion?.("US");
    await ready;

    expect(api.getConsent()).toMatchObject({
      categories: { analytics: true },
      services: { ga: true, amp: true },
    });
  });

  test("gives each ready listener and late replay a defensive prefill copy", async () => {
    const stale = storedState({
      revision: 1,
      services: { ga: true, amp: false, ads: true },
    });
    window.localStorage.setItem("libreconsent", encodeState(stale));
    const api = start(baseConfig({ revision: 2 }));
    const observed: ReadyEvent[] = [];
    api.on("ready", (payload) => {
      if (payload.prefill) {
        payload.prefill.categories.analytics = false;
        payload.prefill.services.ga = false;
      }
    });
    api.on("ready", (payload) => observed.push(payload));

    await waitForReady(api);
    let replay: ReadyEvent | undefined;
    api.on("ready", (payload) => {
      replay = payload;
    });

    expect(observed[0]?.prefill).toMatchObject({
      categories: { analytics: true, marketing: true },
      services: { ga: true, amp: false, ads: true },
    });
    expect(replay?.prefill).toMatchObject({
      categories: { analytics: true, marketing: true },
      services: { ga: true, amp: false, ads: true },
    });
  });
});

describe("storage, expiry, and revision handling (CORE-5, CORE-8..11)", () => {
  test("performs absolutely no storage write before a user decision", async () => {
    const cookieSetter = vi.spyOn(document, "cookie", "set");
    const mirrorSetter = vi.spyOn(window.localStorage, "setItem");
    const api = start(baseConfig());

    await waitForReady(api);
    api.showPreferences();
    api.hide();

    expect(api.getConsent()).toBeNull();
    expect(cookieSetter).not.toHaveBeenCalled();
    expect(mirrorSetter).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("libreconsent=");
    expect(window.localStorage.getItem("libreconsent")).toBeNull();
  });

  test("persists a decision to cookie and localStorage and restores it round-trip", async () => {
    const first = start(baseConfig());
    await waitForReady(first);
    first.setConsent({ services: { ga: true } });
    const decision = first.getConsent();
    const encoded = window.localStorage.getItem("libreconsent");

    expect(encoded).not.toBeNull();
    expect(document.cookie).toContain(`libreconsent=${encoded}`);
    first.reset();
    setDocumentCookie(`libreconsent=${encoded}; Path=/`);
    if (encoded) {
      window.localStorage.setItem("libreconsent", encoded);
    }

    const second = start(baseConfig());
    const ready = await waitForReady(second);
    expect(ready).toMatchObject({ reason: "restored" });
    expect(second.getConsent()).toEqual(decision);
  });

  test("uses a valid cookie as source of truth and reconciles its mirror", async () => {
    const cookieState = storedState({
      consentId: "7798ec00-5f8d-4d84-a0c5-93a266d5a0d9",
      services: { ga: true, amp: false, ads: false },
    });
    const mirrorState = storedState({
      consentId: "2163f168-3060-4d6d-a2cc-d78c7dcc77e3",
      services: { ga: false, amp: false, ads: true },
    });
    setDocumentCookie(`libreconsent=${encodeState(cookieState)}; Path=/`);
    window.localStorage.setItem("libreconsent", encodeState(mirrorState));

    const api = start(baseConfig());
    await waitForReady(api);

    expect(api.getConsent()?.consentId).toBe(cookieState.consentId);
    expect(window.localStorage.getItem("libreconsent")).toBe(
      encodeState(cookieState),
    );
  });

  test("recovers an absent or corrupt cookie from a valid mirror", async () => {
    const mirrorState = storedState({
      consentId: "a6750c62-fdbc-4484-813a-d6025db2b3c0",
    });
    setDocumentCookie("libreconsent=%E0%A4%A; Path=/");
    window.localStorage.setItem("libreconsent", encodeState(mirrorState));

    const api = start(baseConfig());
    const ready = await waitForReady(api);

    expect(ready.reason).toBe("restored");
    expect(api.getConsent()?.consentId).toBe(mirrorState.consentId);
    expect(document.cookie).toContain(
      `libreconsent=${encodeState(mirrorState)}`,
    );
  });

  test("recovers from inaccessible cookie storage and never crashes on unavailable storage", async () => {
    const mirrorState = storedState();
    window.localStorage.setItem("libreconsent", encodeState(mirrorState));
    const inaccessibleCookie = vi
      .spyOn(document, "cookie", "get")
      .mockImplementation(() => {
        throw new Error("cookie access denied");
      });

    const api = start(baseConfig());
    await expect(waitForReady(api)).resolves.toMatchObject({
      reason: "restored",
    });
    expect(api.getConsent()?.consentId).toBe(mirrorState.consentId);

    api.reset();
    inaccessibleCookie.mockRestore();
    const unavailableCookieGet = vi
      .spyOn(document, "cookie", "get")
      .mockImplementation(() => {
        throw new Error("cookie access denied");
      });
    const unavailableCookieSet = vi
      .spyOn(document, "cookie", "set")
      .mockImplementation(() => {
        throw new Error("cookie access denied");
      });
    const unavailableMirrorGet = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("storage access denied");
      });
    const unavailableMirrorSet = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("storage access denied");
      });
    const unavailable = start(baseConfig());
    await expect(waitForReady(unavailable)).resolves.toMatchObject({
      reason: "new",
    });
    expect(() => unavailable.acceptAll()).not.toThrow();
    expect(unavailable.getConsent()?.categories.analytics).toBe(true);

    unavailableCookieGet.mockRestore();
    unavailableCookieSet.mockRestore();
    unavailableMirrorGet.mockRestore();
    unavailableMirrorSet.mockRestore();
  });

  test("treats corrupt cookie and mirror values as no decision", async () => {
    setDocumentCookie("libreconsent=not-json; Path=/");
    window.localStorage.setItem("libreconsent", "%7B%22revision%22%3A1%7D");

    const api = start(baseConfig());
    const ready = await waitForReady(api);

    expect(ready).toEqual({ reason: "new", consent: null, region: null });
    expect(api.getConsent()).toBeNull();
  });

  test.each([
    {
      name: "non-UTC createdAt",
      state: storedState({ createdAt: "2026-07-26T10:00:00+02:00" }),
    },
    {
      name: "malformed updatedAt",
      state: storedState({ updatedAt: "2026-07-26 10:00:00Z" }),
    },
    {
      name: "zero revision",
      state: storedState({ revision: 0 }),
    },
    {
      name: "negative revision",
      state: storedState({ revision: -1 }),
    },
  ])("rejects stored consent with $name", async ({ state }) => {
    window.localStorage.setItem("libreconsent", encodeState(state));

    const api = start(baseConfig());
    const ready = await waitForReady(api);

    expect(ready).toEqual({ reason: "new", consent: null, region: null });
    expect(api.getConsent()).toBeNull();
  });

  test("writes configured cookie attributes and adds Secure only for HTTPS", async () => {
    vi.stubGlobal("location", { protocol: "https:" });
    const cookieSetter = vi.spyOn(document, "cookie", "set");
    const api = start(
      baseConfig({
        storage: {
          cookieName: "private-consent",
          domain: ".example.test",
          expiresDays: 30,
          sameSite: "None",
        },
      }),
    );
    await waitForReady(api);
    api.acceptAll();

    const write = cookieSetter.mock.calls
      .map(([value]) => value)
      .find((value) => value.startsWith("private-consent="));
    expect(write).toContain("Path=/");
    expect(write).toContain("Domain=.example.test");
    expect(write).toContain("SameSite=None");
    expect(write).toContain("Expires=");
    expect(write).toContain("Secure");
  });

  test("omits Secure from cookie writes outside HTTPS", async () => {
    vi.stubGlobal("location", { protocol: "http:" });
    const cookieSetter = vi.spyOn(document, "cookie", "set");
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();

    const write = cookieSetter.mock.calls
      .map(([value]) => value)
      .find((value) => value.startsWith("libreconsent="));
    expect(write).not.toContain("Secure");
  });

  test("expires decisions from updatedAt and leaves them inactive", async () => {
    const old = new Date(Date.now() - 2 * DAY).toISOString();
    const expired = storedState({
      createdAt: new Date(Date.now() - 10 * DAY).toISOString(),
      updatedAt: old,
    });
    window.localStorage.setItem("libreconsent", encodeState(expired));

    const api = start(baseConfig({ storage: { expiresDays: 1 } }));
    const ready = await waitForReady(api);

    expect(ready).toEqual({ reason: "expired", consent: null, region: null });
    expect(api.getConsent()).toBeNull();
  });

  test("does not expire a recently updated decision based on an old createdAt", async () => {
    const active = storedState({
      createdAt: new Date(Date.now() - 100 * DAY).toISOString(),
      updatedAt: new Date(Date.now() - DAY).toISOString(),
    });
    window.localStorage.setItem("libreconsent", encodeState(active));

    const api = start(baseConfig({ storage: { expiresDays: 30 } }));
    const ready = await waitForReady(api);

    expect(ready.reason).toBe("restored");
    expect(api.getConsent()?.consentId).toBe(active.consentId);
  });

  test("keeps decision timestamps valid when the wall clock moves backward", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const config = baseConfig();
    const api = start(config);
    await waitForReady(api);
    api.acceptAll();

    vi.setSystemTime(new Date("2026-07-26T10:00:00.000Z"));
    api.rejectAll();
    const decision = api.getConsent();
    const encoded = window.localStorage.getItem("libreconsent");

    expect(decision?.createdAt).toBe("2026-07-26T12:00:00.000Z");
    expect(decision?.updatedAt).toBe("2026-07-26T12:00:00.000Z");
    expect(encoded).not.toBeNull();

    api.reset();
    window.localStorage.setItem("libreconsent", encoded ?? "");
    const restored = start(config);
    const ready = await waitForReady(restored);

    expect(ready.reason).toBe("restored");
    expect(restored.getConsent()).toMatchObject({
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
      categories: expect.objectContaining({ analytics: false }),
    });
  });

  test("makes lower-revision consent inactive and exposes sanitized prefill", async () => {
    const stale = storedState({
      consentId: "278c5234-2f4d-4639-9b79-90b7732d542f",
      revision: 1,
      categories: {
        necessary: false,
        analytics: true,
        marketing: true,
        removed: true,
      },
      services: {
        ga: true,
        amp: false,
        ads: true,
        removed: true,
      },
    });
    window.localStorage.setItem("libreconsent", encodeState(stale));

    const api = start(baseConfig({ revision: 2 }));
    const ready = await waitForReady(api);

    expect(ready).toEqual({
      reason: "revision",
      consent: null,
      region: null,
      prefill: {
        categories: {
          necessary: true,
          analytics: true,
          marketing: true,
        },
        services: {
          ga: true,
          amp: false,
          ads: true,
        },
      },
    });
    expect(api.getConsent()).toBeNull();

    api.setConsent({ services: { ads: false } });
    expect(api.getConsent()).toMatchObject({
      revision: 2,
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
      services: { ga: true, amp: false, ads: false },
    });
    expect(api.getConsent()?.consentId).not.toBe(stale.consentId);
    expect(api.getConsent()?.consentId).toMatch(UUID_V4);
  });

  test("retains service-less category prefill when revision renewal uses an empty selection", async () => {
    const stale = storedState({
      revision: 1,
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: true,
      },
      services: { ga: false, amp: false, ads: false },
    });
    window.localStorage.setItem("libreconsent", encodeState(stale));
    const config = baseConfig({
      revision: 2,
      categories: [
        ...baseConfig().categories,
        {
          id: "functional",
          label: "category.functional.label",
          description: "category.functional.description",
        },
      ],
    });
    const api = start(config);
    const ready = await waitForReady(api);

    expect(ready).toMatchObject({
      reason: "revision",
      consent: null,
      prefill: {
        categories: { functional: true },
      },
    });

    api.setConsent({});

    expect(api.getConsent()).toMatchObject({
      revision: 2,
      categories: { functional: true },
    });
    expect(api.getConsent()?.consentId).not.toBe(stale.consentId);
  });

  test("sanitizes stored and prefill region-restricted choices against the current region", async () => {
    const config = baseConfig({
      revision: 2,
      resolveRegion: async () => "DE",
    });
    config.categories[0]?.services?.push({
      id: "regional",
      label: "service.regional.label",
      onlyRegions: ["FR"],
    });
    const stale = storedState({
      services: { ga: false, amp: false, ads: false, regional: true },
    });
    window.localStorage.setItem("libreconsent", encodeState(stale));

    const api = start(config);
    const ready = await waitForReady(api);

    expect(ready.prefill?.services.regional).toBe(false);
    expect(ready.prefill?.categories.analytics).toBe(false);
  });

  test("persists withdrawal and emits change immediately", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();
    const change = vi.fn();
    api.on("change", change);

    api.withdraw();

    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith(api.getConsent());
    const encoded = window.localStorage.getItem("libreconsent");
    expect(encoded).not.toBeNull();
    expect(JSON.parse(decodeURIComponent(encoded ?? ""))).toMatchObject({
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
      services: { ga: false, amp: false, ads: false },
    });
  });

  test("withdraw before active consent emits change rather than consent", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const consent = vi.fn();
    const change = vi.fn();
    api.on("consent", consent);
    api.on("change", change);

    api.withdraw();

    expect(consent).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: {
          necessary: true,
          analytics: false,
          marketing: false,
        },
      }),
    );
  });

  test("keeps decisions after an initial withdrawal on the change channel", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const consent = vi.fn();
    const change = vi.fn();
    api.on("consent", consent);
    api.on("change", change);

    api.withdraw();
    api.acceptAll();

    expect(consent).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        categories: expect.objectContaining({ analytics: false }),
      }),
    );
    expect(change).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        categories: expect.objectContaining({ analytics: true }),
      }),
    );
  });
});

describe("optional consent receipt delivery (LOG-4)", () => {
  const endpoint = "/api/consent-receipt";
  type FetchArguments = [
    input: RequestInfo | URL,
    init?: RequestInit | undefined,
  ];
  type FetchImplementation = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;

  function parseReceiptCall(call: FetchArguments): Record<string, unknown> {
    const body = call[1]?.body;
    if (typeof body !== "string") {
      throw new TypeError("Expected a JSON receipt body.");
    }
    return JSON.parse(body) as Record<string, unknown>;
  }

  test("stays completely inert when no endpoint is configured", async () => {
    const fetchMock = vi.fn<FetchImplementation>();
    vi.stubGlobal("fetch", fetchMock);
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    api.setConsent({ categories: { analytics: false } });
    api.withdraw();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("posts the exact payload after persistence with keepalive and maps actions", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("location", {
      host: "app.example.test:8443",
      protocol: "https:",
    });
    const storedAtDelivery: ConsentState[] = [];
    const fetchMock = vi.fn<FetchImplementation>(() => {
      const stored = window.localStorage.getItem("libreconsent");
      if (!stored) {
        throw new Error("Receipt delivery preceded persistence.");
      }
      storedAtDelivery.push(
        JSON.parse(decodeURIComponent(stored)) as ConsentState,
      );
      return Promise.resolve(new Response(null, { status: 201 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = start(baseConfig({ receiptEndpoint: endpoint }));
    await waitForReady(api);

    vi.setSystemTime(new Date("2026-07-27T10:00:00.000Z"));
    api.acceptAll();
    vi.setSystemTime(new Date("2026-07-27T11:00:00.000Z"));
    api.setConsent({ categories: { analytics: false } });
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
    api.withdraw();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const actions = fetchMock.mock.calls.map(
      (call) => parseReceiptCall(call).action,
    );
    expect(actions).toEqual(["consent", "change", "withdraw"]);

    const [target, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const state = api.getConsent();
    const payloads = fetchMock.mock.calls.map((call) => parseReceiptCall(call));
    const firstPayload = payloads[0];
    expect(target).toBe(endpoint);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
    expect(firstPayload).toEqual({
      consentId: expect.stringMatching(UUID_V4),
      host: "app.example.test:8443",
      revision: 1,
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
      ts: "2026-07-27T10:00:00.000Z",
      action: "consent",
    });
    expect(storedAtDelivery).toHaveLength(3);
    for (const [index, stored] of storedAtDelivery.entries()) {
      expect(payloads[index]).toMatchObject({
        consentId: stored.consentId,
        revision: stored.revision,
        categories: stored.categories,
        ts: stored.updatedAt,
      });
    }
    expect(state?.categories).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  test("delivers queued decisions in their original order", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const fetchMock = vi.fn<FetchImplementation>(() =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = start(
      baseConfig({
        receiptEndpoint: endpoint,
        resolveRegion: () =>
          new Promise((resolve) => {
            resolveRegion = resolve;
          }),
      }),
    );

    api.rejectAll();
    api.acceptAll();
    api.withdraw();
    resolveRegion?.(null);
    await waitForReady(api);

    expect(
      fetchMock.mock.calls.map((call) => parseReceiptCall(call)),
    ).toMatchObject([
      { action: "consent", categories: { analytics: false } },
      { action: "change", categories: { analytics: true } },
      { action: "withdraw", categories: { analytics: false } },
    ]);
  });

  test("never posts restored or revision-prefill initialization states", async () => {
    const fetchMock = vi.fn<FetchImplementation>(() =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    setDocumentCookie(`libreconsent=${encodeState(storedState())}; Path=/`);
    const restored = start(baseConfig({ receiptEndpoint: endpoint }));
    await waitForReady(restored);
    expect(fetchMock).not.toHaveBeenCalled();

    restored.rejectAll();
    expect(
      parseReceiptCall(fetchMock.mock.calls[0] as FetchArguments).action,
    ).toBe("change");

    restored.reset();
    fetchMock.mockClear();
    setDocumentCookie(
      `libreconsent=${encodeState(storedState({ revision: 1 }))}; Path=/`,
    );
    const revised = start(
      baseConfig({ receiptEndpoint: endpoint, revision: 2 }),
    );
    const ready = await waitForReady(revised);
    expect(ready.reason).toBe("revision");
    expect(fetchMock).not.toHaveBeenCalled();

    revised.setConsent({ categories: { analytics: true } });
    expect(
      parseReceiptCall(fetchMock.mock.calls[0] as FetchArguments).action,
    ).toBe("consent");
  });

  test("never posts implied or GPC-derived states and treats the next decision as consent", async () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    const fetchMock = vi.fn<FetchImplementation>(() =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = start(
      baseConfig({
        receiptEndpoint: endpoint,
        resolveRegion: async () => "US",
        usPrivacy: { enabled: true },
      }),
    );
    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({ implied: true, gpcApplied: true });
    expect(fetchMock).not.toHaveBeenCalled();

    api.rejectAll();
    expect(
      parseReceiptCall(fetchMock.mock.calls[0] as FetchArguments).action,
    ).toBe("consent");
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  test.each([
    {
      label: "synchronous fetch throw",
      fetcher: vi.fn(() => {
        throw new Error("offline");
      }),
    },
    {
      label: "asynchronous fetch rejection",
      fetcher: vi.fn(() => Promise.reject(new Error("offline"))),
    },
  ])(
    "isolates a $label from state, storage, and events",
    async ({ fetcher }) => {
      vi.stubGlobal("fetch", fetcher);
      const changes: ConsentState[] = [];
      const api = start(baseConfig({ receiptEndpoint: endpoint }));
      api.on("consent", (state) => changes.push(state));
      await waitForReady(api);

      expect(() => api.acceptAll()).not.toThrow();
      await Promise.resolve();

      expect(api.getConsent()?.categories.analytics).toBe(true);
      expect(window.localStorage.getItem("libreconsent")).not.toBeNull();
      expect(changes).toHaveLength(1);
    },
  );
});

describe("US state privacy configuration (CFG-8)", () => {
  test("defaults to a disabled module that respects GPC across US regions", async () => {
    const api = start(baseConfig());
    await waitForReady(api);

    expect(api.getConfig().usPrivacy).toEqual({
      enabled: false,
      regions: ["US"],
      respectGPC: true,
    });
  });

  test("normalizes regions and trims the Do Not Sell selector", async () => {
    const api = start(
      baseConfig({
        usPrivacy: {
          enabled: true,
          regions: [" us-ca ", "us-va"],
          doNotSellSelector: " #do-not-sell ",
          respectGPC: false,
        },
      }),
    );
    await waitForReady(api);

    expect(api.getConfig().usPrivacy).toEqual({
      enabled: true,
      regions: ["US-CA", "US-VA"],
      doNotSellSelector: "#do-not-sell",
      respectGPC: false,
    });
  });

  test("accepts a compound selector, so the check is not merely permissive", async () => {
    // Guards the selector validation against being tightened into something
    // that only accepts simple selectors.
    const selector = 'footer a[href^="#"]:not(.external), [data-optout] > span';
    const api = start(
      baseConfig({ usPrivacy: { enabled: true, doNotSellSelector: selector } }),
    );
    await waitForReady(api);

    expect(api.getConfig().usPrivacy.doNotSellSelector).toBe(selector);
  });

  test.each([
    { name: "block", usPrivacy: [] as unknown, path: "usPrivacy" },
    {
      name: "enabled",
      usPrivacy: { enabled: "yes" },
      path: "usPrivacy.enabled",
    },
    {
      name: "respectGPC",
      usPrivacy: { respectGPC: 1 },
      path: "usPrivacy.respectGPC",
    },
    {
      name: "doNotSellSelector",
      usPrivacy: { doNotSellSelector: "  " },
      path: "usPrivacy.doNotSellSelector",
    },
    {
      // Swallowed by the UI's click guard if it reaches the browser, which
      // leaves the US-2 entry point dead and says nothing (CFG-6).
      name: "unparseable doNotSellSelector",
      usPrivacy: { doNotSellSelector: "[" },
      path: "usPrivacy.doNotSellSelector",
    },
    {
      name: "regions type",
      usPrivacy: { regions: "US" },
      path: "usPrivacy.regions",
    },
    {
      name: "duplicate regions",
      usPrivacy: { regions: ["US", "us"] },
      path: "usPrivacy.regions[1]",
    },
  ])("rejects an invalid $name", ({ usPrivacy, path }) => {
    expectConsentError(
      () =>
        start(
          baseConfig({
            usPrivacy: usPrivacy as NonNullable<CmpConfig["usPrivacy"]>,
          }),
        ),
      "INVALID_CONFIG",
      path,
    );
  });

  test("rejects an empty region list rather than silently disabling itself", () => {
    expectConsentError(
      () => start(baseConfig({ usPrivacy: { enabled: true, regions: [] } })),
      "INVALID_CONFIG",
      "usPrivacy.regions",
    );
  });

  test("validates the signal mapping the opt-out reads even when Consent Mode is off", () => {
    expectConsentError(
      () =>
        start({
          categories: [
            {
              id: "analytics",
              label: "category.analytics.label",
              description: "category.analytics.description",
            },
          ],
          i18n: { default: "en", translations: { en: dictionary } },
          usPrivacy: { enabled: true },
        }),
      "INVALID_CONFIG",
      "consentMode.mapping.ad_storage",
    );
  });

  test("accepts a US-only configuration with no analytics category", async () => {
    // The US module reads only the three ad signals, so the unused default
    // `analytics_storage` target must not make a valid configuration throw.
    const api = start({
      categories: [
        {
          id: "marketing",
          label: "category.marketing.label",
          description: "category.marketing.description",
        },
      ],
      i18n: { default: "en", translations: { en: dictionary } },
      usPrivacy: { enabled: true },
    });

    await waitForReady(api);

    expect(api.getConfig().categories.map(({ id }) => id)).toEqual([
      "necessary",
      "marketing",
    ]);
  });

  test("still validates all four signals when Consent Mode is enabled", () => {
    expectConsentError(
      () =>
        start({
          categories: [
            {
              id: "marketing",
              label: "category.marketing.label",
              description: "category.marketing.description",
            },
          ],
          i18n: { default: "en", translations: { en: dictionary } },
          consentMode: { enabled: true },
          usPrivacy: { enabled: true },
        }),
      "INVALID_CONFIG",
      "consentMode.mapping.analytics_storage",
    );
  });

  test("rejects an ad signal mapped to a permanently granted category", () => {
    expectConsentError(
      () =>
        start(
          baseConfig({
            usPrivacy: { enabled: true },
            consentMode: { mapping: { ad_storage: "necessary" } },
          }),
        ),
      "INVALID_CONFIG",
      "consentMode.mapping.ad_storage",
    );
  });
});

describe("US opt-out model and Global Privacy Control (US-1, US-3)", () => {
  function usConfig(overrides: Partial<CmpConfig> = {}): CmpConfig {
    return baseConfig({
      resolveRegion: async () => "US",
      usPrivacy: { enabled: true },
      ...overrides,
    });
  }

  function stubGpc(value: boolean): void {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      get: () => value,
    });
  }

  function expectNothingStored(): void {
    expect(document.cookie).not.toContain("libreconsent=");
    expect(window.localStorage.getItem("libreconsent")).toBeNull();
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  test("treats an undecided US visitor as consenting without prompting or storing (US-3)", async () => {
    const consent = vi.fn();
    const api = start(usConfig());
    api.on("consent", consent);

    const ready = await waitForReady(api);

    expect(ready.reason).toBe("new");
    expect(ready.consent).toMatchObject({
      implied: true,
      categories: { necessary: true, analytics: true, marketing: true },
      services: { ga: true, amp: true, ads: true },
      region: "US",
    });
    expect(ready.consent?.gpcApplied).toBeUndefined();
    expect(consent).toHaveBeenCalledTimes(1);
    expectNothingStored();
  });

  test("denies the mapped ad categories when Global Privacy Control is set (US-1)", async () => {
    stubGpc(true);
    const api = start(usConfig());

    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({
      implied: true,
      gpcApplied: true,
      categories: { analytics: true, marketing: false },
      services: { ga: true, amp: true, ads: false },
    });
    expectNothingStored();
  });

  test("follows the configured mapping when choosing what an opt-out denies", async () => {
    stubGpc(true);
    const config = usConfig({
      consentMode: {
        mapping: {
          ad_storage: "functional",
          ad_user_data: "functional",
          ad_personalization: "functional",
        },
      },
    });
    config.categories.push({
      id: "functional",
      label: "category.functional.label",
      description: "category.functional.description",
    });
    const api = start(config);

    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({
      categories: { analytics: true, marketing: true, functional: false },
    });
  });

  test("signals the opt-out to Consent Mode without a decision (US-1, CM-2)", async () => {
    stubGpc(true);
    const gtag = vi.fn();
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    const api = start(usConfig({ consentMode: { enabled: true } }));

    await waitForReady(api);

    expect(gtag.mock.calls).toEqual([
      [
        "consent",
        "update",
        {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ],
    ]);
  });

  test("leaves the signal unread when respectGPC is disabled", async () => {
    stubGpc(true);
    const api = start(
      usConfig({ usPrivacy: { enabled: true, respectGPC: false } }),
    );

    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({
      implied: true,
      categories: { marketing: true },
    });
    expect(ready.consent?.gpcApplied).toBeUndefined();
  });

  test.each([
    { name: "a non-US region", region: "DE" },
    { name: "an unresolved region", region: null },
    { name: "a region that merely shares a prefix", region: "USA" },
    { name: "a country when a state is configured", region: "US" },
  ])("asks an opt-in decision for $name", async ({ region }) => {
    stubGpc(true);
    const api = start(
      usConfig({
        resolveRegion: async () => region,
        usPrivacy: {
          enabled: true,
          ...(region === "US" ? { regions: ["US-CA"] } : {}),
        },
      }),
    );

    const ready = await waitForReady(api);

    expect(ready.consent).toBeNull();
    expectNothingStored();
  });

  test("matches a state-level region against a configured country", async () => {
    const api = start(usConfig({ resolveRegion: async () => "us-ca" }));

    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({ implied: true, region: "US-CA" });
  });

  test("keeps region-restricted services denied under the implied grant", async () => {
    const config = usConfig();
    config.categories[0]?.services?.push({
      id: "regional",
      label: "service.regional.label",
      onlyRegions: ["FR"],
    });
    const api = start(config);

    const ready = await waitForReady(api);

    expect(ready.consent).toMatchObject({
      services: { ga: true, regional: false },
    });
  });

  test("lets a stored decision outrank the signal (US-1)", async () => {
    stubGpc(true);
    const restored = storedState({
      categories: { necessary: true, analytics: false, marketing: true },
      services: { ga: false, amp: false, ads: true },
    });
    setDocumentCookie(`libreconsent=${encodeState(restored)}; Path=/`);
    const api = start(usConfig());

    const ready = await waitForReady(api);

    expect(ready.reason).toBe("restored");
    expect(ready.consent).toMatchObject({
      consentId: restored.consentId,
      categories: { analytics: false, marketing: true },
    });
    expect(ready.consent?.implied).toBeUndefined();
    expect(ready.consent?.gpcApplied).toBeUndefined();
  });

  test.each([
    { name: "expiry", reason: "expired", revision: 1, expiresDays: 30 },
    {
      name: "a revision bump",
      reason: "revision",
      revision: 2,
      expiresDays: 365,
    },
  ])(
    "seeds the implied state from choices invalidated by $name",
    async ({ reason, revision, expiresDays }) => {
      const timestamp = new Date(Date.now() - 60 * DAY).toISOString();
      const lapsed = storedState({
        createdAt: timestamp,
        updatedAt: timestamp,
        categories: { necessary: true, analytics: true, marketing: false },
        services: { ga: true, amp: false, ads: false },
      });
      setDocumentCookie(`libreconsent=${encodeState(lapsed)}; Path=/`);
      const api = start(usConfig({ revision, storage: { expiresDays } }));

      const ready = await waitForReady(api);

      expect(ready.reason).toBe(reason);
      expect(ready.prefill).toBeUndefined();
      expect(ready.consent).toMatchObject({
        implied: true,
        categories: { analytics: true, marketing: false },
        services: { ga: true, amp: false, ads: false },
      });
      expect(ready.consent?.consentId).not.toBe(lapsed.consentId);
      expect(document.cookie).not.toContain("implied");
    },
  );

  test("never lets a restored decision claim Global Privacy Control produced it", async () => {
    // The flag is never written, so one in storage came from tampering or
    // another writer. Copying it would misreport the decision's origin.
    const tampered = storedState({ gpcApplied: true });
    setDocumentCookie(`libreconsent=${encodeState(tampered)}; Path=/`);
    const api = start(usConfig());

    const ready = await waitForReady(api);

    expect(ready.reason).toBe("restored");
    expect(ready.consent?.gpcApplied).toBeUndefined();
    expect(api.getConsent()?.gpcApplied).toBeUndefined();
  });

  test("seeds the implied state from a decision written by a newer revision", async () => {
    // A rollback leaves a cookie ahead of the configured revision. It matches
    // no classification branch, so the visitor is undecided — but their
    // recorded choices are still theirs and must not widen to a full grant.
    const ahead = storedState({
      revision: 5,
      categories: { necessary: true, analytics: true, marketing: false },
      services: { ga: true, amp: false, ads: false },
    });
    setDocumentCookie(`libreconsent=${encodeState(ahead)}; Path=/`);
    const api = start(usConfig());

    const ready = await waitForReady(api);

    expect(ready.reason).toBe("new");
    expect(ready.consent).toMatchObject({
      implied: true,
      categories: { analytics: true, marketing: false },
      services: { ga: true, amp: false, ads: false },
    });
    expect(document.cookie).not.toContain("implied");
  });

  test("persists an explicit decision without the implied markers (US-2)", async () => {
    stubGpc(true);
    const api = start(usConfig());
    await waitForReady(api);
    const change = vi.fn();
    api.on("change", change);

    api.setConsent({ categories: { marketing: false } });

    const state = api.getConsent();
    expect(state).toMatchObject({
      categories: { analytics: true, marketing: false },
    });
    expect(state?.implied).toBeUndefined();
    expect(state?.gpcApplied).toBeUndefined();
    expect(change).toHaveBeenCalledTimes(1);
    const stored = window.localStorage.getItem("libreconsent");
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("implied");
    expect(stored).not.toContain("gpcApplied");
  });

  test("withdraws from an implied state into a persisted all-denied decision", async () => {
    const api = start(usConfig());
    await waitForReady(api);

    api.withdraw();

    expect(api.getConsent()).toMatchObject({
      categories: { necessary: true, analytics: false, marketing: false },
    });
    expect(api.getConsent()?.implied).toBeUndefined();
    expect(window.localStorage.getItem("libreconsent")).not.toBeNull();
  });

  test("stays inert when the module is disabled", async () => {
    stubGpc(true);
    const api = start(baseConfig({ resolveRegion: async () => "US" }));

    const ready = await waitForReady(api);

    expect(ready.consent).toBeNull();
    expectNothingStored();
  });

  test("forwards the opt-out intent only to renderers that implement it (US-2)", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    const showOptOut = vi.fn();
    const base = { showPreferences: () => undefined, hide: () => undefined };

    api.registerRenderer({ ...base, showOptOut });
    api.showOptOut();
    expect(showOptOut).toHaveBeenCalledTimes(1);

    api.registerRenderer(base);
    expect(() => api.showOptOut()).not.toThrow();

    api.registerRenderer({
      ...base,
      showOptOut: () => {
        throw new Error("renderer failure");
      },
    });
    expect(() => api.showOptOut()).not.toThrow();
  });
});

describe("reset (CORE-2)", () => {
  test("clears active state, listeners, and stored data and releases the singleton", async () => {
    const api = start(baseConfig());
    await waitForReady(api);
    api.acceptAll();
    const change = vi.fn();
    api.on("change", change);
    expect(window.localStorage.getItem("libreconsent")).not.toBeNull();

    api.reset();

    expect(api.getConsent()).toBeNull();
    expect(window.localStorage.getItem("libreconsent")).toBeNull();
    expect(document.cookie).not.toContain("libreconsent=");
    api.rejectAll();
    expect(change).not.toHaveBeenCalled();
    const replacement = start(baseConfig());
    expect(replacement).not.toBe(api);
    await waitForReady(replacement);
  });

  test("invalidates pending initialization and drops queued decisions", async () => {
    let resolveRegion: ((region: string | null) => void) | undefined;
    const pendingRegion = new Promise<string | null>((resolve) => {
      resolveRegion = resolve;
    });
    const api = start(baseConfig({ resolveRegion: () => pendingRegion }));
    const ready = vi.fn();
    const consent = vi.fn();
    api.on("ready", ready);
    api.on("consent", consent);
    api.acceptAll();

    api.reset();
    resolveRegion?.("FR");
    await Promise.resolve();
    await Promise.resolve();

    expect(ready).not.toHaveBeenCalled();
    expect(consent).not.toHaveBeenCalled();
    expect(api.getConsent()).toBeNull();
    expect(window.localStorage.getItem("libreconsent")).toBeNull();
  });
});
