import type { Dictionary, NormalizedCmpConfig } from "@libreconsent/core";
import { uiDictionaries, uiEn } from "./dictionaries";

/** Locale codes the core normalized into complete dictionaries. */
function availableLocales(config: NormalizedCmpConfig): string[] {
  return Object.keys(config.i18n.translations);
}

/** Lowercased base language of a locale tag (`fr-CA` becomes `fr`). */
function baseLanguage(locale: string): string {
  return (locale.split("-")[0] ?? locale).toLowerCase();
}

/**
 * Finds the configured locale matching `wanted`, preferring an exact
 * case-insensitive tag match over a base-language match.
 */
function matchLocale(available: string[], wanted: string): string | null {
  const target = wanted.toLowerCase();
  const exact = available.find((locale) => locale.toLowerCase() === target);
  if (exact !== undefined) {
    return exact;
  }
  const language = baseLanguage(wanted);
  return available.find((locale) => baseLanguage(locale) === language) ?? null;
}

/**
 * Resolves the locale the renderer should use.
 *
 * An explicit `locale` option wins and must match a configured locale — a
 * typo there is a setup error, not a silent fallback. Otherwise browser
 * languages are consulted when `i18n.autoDetect` is on (the core defers that
 * behavior to this package), and the configured default is the last resort.
 */
export function resolveLocale(
  config: NormalizedCmpConfig,
  override: string | null,
): string {
  const available = availableLocales(config);
  if (override !== null) {
    const matched = matchLocale(available, override);
    if (matched === null) {
      throw new Error(
        `options.locale: "${override}" is not a configured locale`,
      );
    }
    return matched;
  }
  if (config.i18n.autoDetect) {
    const preferred =
      typeof navigator === "undefined" ? [] : (navigator.languages ?? []);
    for (const candidate of preferred) {
      const matched = matchLocale(available, candidate);
      if (matched !== null) {
        return matched;
      }
    }
  }
  return config.i18n.default;
}

/**
 * Builds the effective dictionary for `locale`.
 *
 * Renderer reference strings fill the gaps the core does not ship, and the
 * host's configured translations win over both so any string stays overridable.
 */
export function buildDictionary(
  config: NormalizedCmpConfig,
  locale: string,
): Dictionary {
  const reference =
    uiDictionaries[locale] ?? uiDictionaries[baseLanguage(locale)] ?? uiEn;
  return {
    ...uiEn,
    ...reference,
    ...config.i18n.translations[locale],
  };
}

/**
 * Looks up a translation key, returning the key itself when it is missing so
 * the gap is visible rather than silent (matching the core's behavior).
 */
export function translate(dictionary: Dictionary, key: string): string {
  return dictionary[key] ?? key;
}
