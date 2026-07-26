import type { NormalizedCmpConfig } from "./types";

/**
 * Resolves a translation key against the effective default locale.
 *
 * Normalized dictionaries already have default-locale fallbacks merged in, so a
 * single lookup is enough. An unknown key returns the key itself rather than an
 * empty string, which keeps a missing translation visible instead of silent.
 * Browser-language selection (`i18n.autoDetect`) arrives with the UI package.
 */
export function translate(
  i18n: NormalizedCmpConfig["i18n"],
  key: string,
): string {
  return i18n.translations[i18n.default]?.[key] ?? key;
}
