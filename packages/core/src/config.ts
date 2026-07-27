import { en, fr } from "./dictionaries";
import { ConsentError } from "./errors";
import type {
  BlocklistEntry,
  CategoryConfig,
  CmpConfig,
  ConsentModeDefaults,
  CookieTableRow,
  Dictionary,
  GoogleSignal,
  NormalizedBlockingConfig,
  NormalizedCategoryConfig,
  NormalizedCmpConfig,
  NormalizedServiceConfig,
} from "./types";

const SIGNALS: GoogleSignal[] = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
];

const DEFAULT_MAPPING: Record<GoogleSignal, string> = {
  analytics_storage: "analytics",
  ad_storage: "marketing",
  ad_user_data: "marketing",
  ad_personalization: "marketing",
};

function invalid(path: string, message: string): never {
  throw new ConsentError("INVALID_CONFIG", path, message);
}

function requireRecord(value: unknown, path: string): asserts value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(path, "must be an object");
  }
}

function requireNonEmptyString(
  value: unknown,
  path: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    invalid(path, "must be a non-empty string");
  }
}

function optionalBoolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "boolean") {
    invalid(path, "must be a boolean");
  }
}

function normalizeRegions(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    invalid(path, "must be an array");
  }
  const seen = new Set<string>();
  return value.map((region, index) => {
    requireNonEmptyString(region, `${path}[${index}]`);
    const normalized = region.trim().toUpperCase();
    if (seen.has(normalized)) {
      invalid(`${path}[${index}]`, `duplicates region "${normalized}"`);
    }
    seen.add(normalized);
    return normalized;
  });
}

function normalizeCookieRow(
  row: CookieTableRow,
  path: string,
  referencedKeys: Set<string>,
): CookieTableRow {
  requireRecord(row, path);
  requireNonEmptyString(row.name, `${path}.name`);
  requireNonEmptyString(row.purpose, `${path}.purpose`);
  referencedKeys.add(row.purpose);

  const normalized: CookieTableRow = {
    name: row.name,
    purpose: row.purpose,
  };

  for (const key of ["provider", "duration", "type"] as const) {
    const value = row[key];
    if (value !== undefined) {
      requireNonEmptyString(value, `${path}.${key}`);
      referencedKeys.add(value);
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeCategories(input: CategoryConfig[]): {
  categories: NormalizedCategoryConfig[];
  referencedKeys: Set<string>;
} {
  if (!Array.isArray(input)) {
    invalid("categories", "must be an array");
  }

  const source = input.map((category, index) => ({
    category,
    path: `categories[${index}]`,
  }));
  const necessaryIndex = source.findIndex(
    ({ category }) => category?.id === "necessary",
  );
  if (necessaryIndex === -1) {
    source.unshift({
      category: {
        id: "necessary",
        label: "category.necessary.label",
        description: "category.necessary.description",
        readonly: true,
        enabled: true,
        services: [],
      },
      path: "categories[necessary]",
    });
  } else if (necessaryIndex > 0) {
    const [necessary] = source.splice(necessaryIndex, 1);
    if (necessary) {
      source.unshift(necessary);
    }
  }

  const categoryIds = new Set<string>();
  const serviceIds = new Set<string>();
  const referencedKeys = new Set<string>();

  const categories = source.map(
    ({ category, path }): NormalizedCategoryConfig => {
      requireRecord(category, path);
      requireNonEmptyString(category.id, `${path}.id`);
      requireNonEmptyString(category.label, `${path}.label`);
      requireNonEmptyString(category.description, `${path}.description`);
      optionalBoolean(category.readonly, `${path}.readonly`);
      optionalBoolean(category.enabled, `${path}.enabled`);

      if (categoryIds.has(category.id)) {
        invalid(`${path}.id`, `duplicates category "${category.id}"`);
      }
      categoryIds.add(category.id);
      referencedKeys.add(category.label);
      referencedKeys.add(category.description);

      const readonly =
        category.id === "necessary" || category.readonly === true;
      if (!readonly && category.enabled === true) {
        invalid(`${path}.enabled`, "optional categories cannot start enabled");
      }
      if (category.id === "necessary" && category.enabled === false) {
        invalid(`${path}.enabled`, "necessary must be enabled");
      }

      const rawServices = category.services ?? [];
      if (!Array.isArray(rawServices)) {
        invalid(`${path}.services`, "must be an array");
      }
      const services = rawServices.map(
        (service, serviceIndex): NormalizedServiceConfig => {
          const servicePath = `${path}.services[${serviceIndex}]`;
          requireRecord(service, servicePath);
          requireNonEmptyString(service.id, `${servicePath}.id`);
          requireNonEmptyString(service.label, `${servicePath}.label`);
          if (serviceIds.has(service.id)) {
            invalid(`${servicePath}.id`, `duplicates service "${service.id}"`);
          }
          serviceIds.add(service.id);
          referencedKeys.add(service.label);

          const rawCookies = service.cookies ?? [];
          if (!Array.isArray(rawCookies)) {
            invalid(`${servicePath}.cookies`, "must be an array");
          }
          return {
            id: service.id,
            label: service.label,
            cookies: rawCookies.map((row, cookieIndex) =>
              normalizeCookieRow(
                row,
                `${servicePath}.cookies[${cookieIndex}]`,
                referencedKeys,
              ),
            ),
            onlyRegions: normalizeRegions(
              service.onlyRegions,
              `${servicePath}.onlyRegions`,
            ),
          };
        },
      );

      return {
        id: category.id,
        label: category.label,
        description: category.description,
        readonly,
        enabled:
          category.id === "necessary" ? true : (category.enabled ?? readonly),
        services,
      };
    },
  );

  return { categories, referencedKeys };
}

function normalizeDefaults(value: unknown): ConsentModeDefaults {
  if (value === undefined || value === "denied-everywhere") {
    return "denied-everywhere";
  }
  requireRecord(value, "consentMode.defaults");
  if (!("deniedRegions" in value)) {
    invalid("consentMode.defaults.deniedRegions", "is required");
  }
  return {
    deniedRegions: normalizeRegions(
      value.deniedRegions,
      "consentMode.defaults.deniedRegions",
    ),
  };
}

function cloneDictionary(dictionary: Readonly<Dictionary>): Dictionary {
  return { ...dictionary };
}

function normalizeI18n(
  config: CmpConfig["i18n"],
  referencedKeys: Set<string>,
): NormalizedCmpConfig["i18n"] {
  if (config !== undefined) {
    requireRecord(config, "i18n");
  }
  const defaultLocale = config?.default ?? "en";
  requireNonEmptyString(defaultLocale, "i18n.default");
  optionalBoolean(config?.autoDetect, "i18n.autoDetect");

  const supplied = config?.translations ?? {};
  requireRecord(supplied, "i18n.translations");
  const reference: Record<string, Dictionary> = {
    en: cloneDictionary(en),
    fr: cloneDictionary(fr),
  };
  const defaultDictionary = {
    ...(reference[defaultLocale] ?? {}),
    ...(supplied[defaultLocale] ?? {}),
  };

  if (Object.keys(defaultDictionary).length === 0) {
    invalid(
      `i18n.translations.${defaultLocale}`,
      "must provide the default locale dictionary",
    );
  }
  for (const key of referencedKeys) {
    if (typeof defaultDictionary[key] !== "string") {
      invalid(
        `i18n.translations.${defaultLocale}.${key}`,
        "is required by the configured categories or services",
      );
    }
  }

  const locales = new Set([
    ...Object.keys(reference),
    ...Object.keys(supplied),
    defaultLocale,
  ]);
  const translations: Record<string, Dictionary> = {};
  for (const locale of locales) {
    const dictionary = supplied[locale];
    if (dictionary !== undefined) {
      requireRecord(dictionary, `i18n.translations.${locale}`);
      for (const [key, value] of Object.entries(dictionary)) {
        if (typeof value !== "string") {
          invalid(`i18n.translations.${locale}.${key}`, "must be a string");
        }
      }
    }
    translations[locale] = {
      ...defaultDictionary,
      ...(reference[locale] ?? {}),
      ...(dictionary ?? {}),
    };
  }

  return {
    default: defaultLocale,
    autoDetect: config?.autoDetect ?? false,
    translations,
  };
}

function normalizeBlocklist(value: unknown): BlocklistEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    invalid("blocking.blocklist", "must be an array");
  }
  return value.map((entry: BlocklistEntry, index) => {
    const path = `blocking.blocklist[${index}]`;
    requireRecord(entry, path);
    requireNonEmptyString(entry.pattern, `${path}.pattern`);
    requireNonEmptyString(entry.category, `${path}.category`);
    if (entry.service !== undefined) {
      requireNonEmptyString(entry.service, `${path}.service`);
    }
    return {
      pattern: entry.pattern.trim(),
      category: entry.category.trim(),
      ...(entry.service === undefined ? {} : { service: entry.service.trim() }),
    };
  });
}

function normalizeBlocking(
  config: CmpConfig["blocking"],
): NormalizedBlockingConfig {
  if (config !== undefined) {
    requireRecord(config, "blocking");
  }
  if (config?.nonce !== undefined) {
    requireNonEmptyString(config.nonce, "blocking.nonce");
  }
  optionalBoolean(config?.reloadOnWithdraw, "blocking.reloadOnWithdraw");
  return {
    ...(config?.nonce === undefined ? {} : { nonce: config.nonce }),
    reloadOnWithdraw: config?.reloadOnWithdraw ?? false,
    blocklist: normalizeBlocklist(config?.blocklist),
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

export function normalizeConfig(config: CmpConfig): NormalizedCmpConfig {
  requireRecord(config, "config");
  const { categories, referencedKeys } = normalizeCategories(config.categories);

  if (config.storage !== undefined) {
    requireRecord(config.storage, "storage");
  }
  const cookieName = config.storage?.cookieName ?? "libreconsent";
  requireNonEmptyString(cookieName, "storage.cookieName");
  if (config.storage?.domain !== undefined) {
    requireNonEmptyString(config.storage.domain, "storage.domain");
  }
  const expiresDays = config.storage?.expiresDays ?? 365;
  if (
    typeof expiresDays !== "number" ||
    !Number.isInteger(expiresDays) ||
    expiresDays < 1 ||
    expiresDays > 395
  ) {
    invalid("storage.expiresDays", "must be an integer from 1 to 395");
  }
  const sameSite = config.storage?.sameSite ?? "Lax";
  if (!["Strict", "Lax", "None"].includes(sameSite)) {
    invalid("storage.sameSite", 'must be "Strict", "Lax", or "None"');
  }

  const revision = config.revision ?? 1;
  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    invalid("revision", "must be a positive integer");
  }

  if (config.consentMode !== undefined) {
    requireRecord(config.consentMode, "consentMode");
  }
  optionalBoolean(config.consentMode?.enabled, "consentMode.enabled");
  optionalBoolean(
    config.consentMode?.adsDataRedaction,
    "consentMode.adsDataRedaction",
  );
  optionalBoolean(
    config.consentMode?.urlPassthrough,
    "consentMode.urlPassthrough",
  );
  const waitForUpdate = config.consentMode?.waitForUpdate ?? 500;
  if (
    typeof waitForUpdate !== "number" ||
    !Number.isInteger(waitForUpdate) ||
    waitForUpdate < 1
  ) {
    invalid("consentMode.waitForUpdate", "must be a positive integer");
  }

  const suppliedMapping = config.consentMode?.mapping ?? {};
  requireRecord(suppliedMapping, "consentMode.mapping");
  for (const signal of Object.keys(suppliedMapping)) {
    if (!SIGNALS.includes(signal as GoogleSignal)) {
      invalid(
        `consentMode.mapping.${signal}`,
        "is not a supported Google signal",
      );
    }
  }
  const mapping = { ...DEFAULT_MAPPING };
  for (const signal of SIGNALS) {
    const mapped = suppliedMapping[signal];
    if (mapped !== undefined) {
      requireNonEmptyString(mapped, `consentMode.mapping.${signal}`);
      mapping[signal] = mapped;
      if (!categories.some((category) => category.id === mapped)) {
        invalid(
          `consentMode.mapping.${signal}`,
          `references unknown category "${mapped}"`,
        );
      }
    }
  }
  if (config.consentMode?.enabled === true) {
    for (const signal of SIGNALS) {
      const mapped = mapping[signal];
      if (!categories.some((category) => category.id === mapped)) {
        invalid(
          `consentMode.mapping.${signal}`,
          `references unknown category "${mapped}"`,
        );
      }
    }
  }

  if (
    config.resolveRegion !== undefined &&
    typeof config.resolveRegion !== "function"
  ) {
    invalid("resolveRegion", "must be a function");
  }

  const storage =
    config.storage?.domain === undefined
      ? { cookieName, expiresDays, sameSite }
      : { cookieName, domain: config.storage.domain, expiresDays, sameSite };

  const normalized: NormalizedCmpConfig = {
    categories,
    consentMode: {
      enabled: config.consentMode?.enabled ?? false,
      mapping,
      defaults: normalizeDefaults(config.consentMode?.defaults),
      waitForUpdate,
      adsDataRedaction: config.consentMode?.adsDataRedaction ?? false,
      urlPassthrough: config.consentMode?.urlPassthrough ?? false,
    },
    storage,
    blocking: normalizeBlocking(config.blocking),
    revision,
    i18n: normalizeI18n(config.i18n, referencedKeys),
    ...(config.resolveRegion === undefined
      ? {}
      : { resolveRegion: config.resolveRegion }),
  };

  return deepFreeze(normalized);
}

export function sameConfig(
  left: NormalizedCmpConfig,
  right: NormalizedCmpConfig,
): boolean {
  if (left.resolveRegion !== right.resolveRegion) {
    return false;
  }
  const withoutResolver = (value: NormalizedCmpConfig): unknown => {
    const { resolveRegion: _resolveRegion, ...rest } = value;
    return rest;
  };
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return value;
  };
  return (
    JSON.stringify(canonicalize(withoutResolver(left))) ===
    JSON.stringify(canonicalize(withoutResolver(right)))
  );
}
