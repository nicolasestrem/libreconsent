// SPDX-License-Identifier: MIT
import type {
  ConsentApi,
  I18nConfig,
  NormalizedCmpConfig,
} from "@libreconsent/core";
import { init } from "@libreconsent/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uiEn, uiFr } from "./dictionaries";
import { buildDictionary, resolveLocale, translate } from "./i18n";

const labels = {
  "category.analytics.label": "Analytics",
  "category.analytics.description": "Analytics description",
};

const activeApis = new Set<ConsentApi>();

/**
 * Normalizes `i18n` through the real core so the locale list under test is the
 * one the renderer actually receives, including the always-present `en` and
 * `fr` reference dictionaries.
 */
function normalizedConfig(i18n: I18nConfig): NormalizedCmpConfig {
  const api = init({
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
      },
    ],
    i18n,
  });
  activeApis.add(api);
  return api.getConfig();
}

function stubLanguages(languages: string[]): void {
  vi.stubGlobal("navigator", { languages });
}

afterEach(() => {
  for (const api of activeApis) {
    api.reset();
  }
  activeApis.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("locale resolution (UI-8)", () => {
  test("prefers an explicit locale override over the browser languages", () => {
    const config = normalizedConfig({
      default: "en",
      autoDetect: true,
      translations: { en: labels, de: labels },
    });
    stubLanguages(["de"]);

    expect(resolveLocale(config, "fr")).toBe("fr");
  });

  test("matches a locale override case-insensitively", () => {
    const config = normalizedConfig({
      default: "en",
      translations: { en: labels },
    });

    expect(resolveLocale(config, "FR")).toBe("fr");
  });

  test("throws when the locale override is not a configured locale", () => {
    const config = normalizedConfig({
      default: "en",
      translations: { en: labels },
    });

    expect(() => resolveLocale(config, "zz")).toThrow(
      'options.locale: "zz" is not a configured locale',
    );
  });

  test("ignores the browser languages when autoDetect is off", () => {
    const config = normalizedConfig({
      default: "en",
      autoDetect: false,
      translations: { en: labels },
    });
    stubLanguages(["fr-FR", "fr"]);

    expect(resolveLocale(config, null)).toBe("en");
  });

  test("picks the first exactly matching browser language when autoDetect is on", () => {
    const config = normalizedConfig({
      default: "en",
      autoDetect: true,
      translations: { en: labels, de: labels },
    });
    stubLanguages(["de", "fr"]);

    expect(resolveLocale(config, null)).toBe("de");
  });

  test("falls a regional browser language back to its base language", () => {
    const config = normalizedConfig({
      default: "en",
      autoDetect: true,
      translations: { en: labels },
    });
    stubLanguages(["fr-CA"]);

    expect(resolveLocale(config, null)).toBe("fr");
  });

  test("falls back to the configured default when no browser language matches", () => {
    const config = normalizedConfig({
      default: "en",
      autoDetect: true,
      translations: { en: labels },
    });
    stubLanguages(["ja", "ko"]);

    expect(resolveLocale(config, null)).toBe("en");
  });
});

describe("dictionary building (UI-8)", () => {
  test("lets a host translation override the renderer reference string", () => {
    const config = normalizedConfig({
      default: "en",
      translations: { en: { ...labels, "ui.title": "Your privacy choices" } },
    });

    expect(buildDictionary(config, "en")["ui.title"]).toBe(
      "Your privacy choices",
    );
  });

  test("fills the renderer-only keys the core does not ship", () => {
    const config = normalizedConfig({
      default: "en",
      translations: { en: labels },
    });

    const dictionary = buildDictionary(config, "en");

    expect(dictionary["ui.cookies.purpose"]).toBe(uiEn["ui.cookies.purpose"]);
    expect(dictionary["ui.alwaysOn"]).toBe(uiEn["ui.alwaysOn"]);
    expect(dictionary["ui.acceptAll"]).toBe("Accept all");
    expect(dictionary["category.analytics.label"]).toBe("Analytics");
  });

  test("uses the renderer reference dictionary matching the locale", () => {
    const config = normalizedConfig({
      default: "en",
      translations: { en: labels },
    });

    const dictionary = buildDictionary(config, "fr");

    expect(dictionary["ui.title"]).toBe(uiFr["ui.title"]);
    expect(dictionary["ui.acceptAll"]).toBe("Tout accepter");
  });

  test("resolves English renderer strings for a locale with no reference dictionary", () => {
    const config = normalizedConfig({
      default: "en",
      translations: {
        en: labels,
        de: { "category.analytics.label": "Analyse" },
      },
    });

    const dictionary = buildDictionary(config, "de");

    expect(dictionary["ui.title"]).toBe(uiEn["ui.title"]);
    expect(dictionary["ui.cookies.name"]).toBe(uiEn["ui.cookies.name"]);
    expect(dictionary["category.analytics.label"]).toBe("Analyse");
  });
});

describe("translation lookup (UI-8)", () => {
  test("returns the key itself when the dictionary has no entry", () => {
    expect(translate({ "ui.title": "Title" }, "ui.missing")).toBe("ui.missing");
    expect(translate({ "ui.title": "Title" }, "ui.title")).toBe("Title");
  });
});
