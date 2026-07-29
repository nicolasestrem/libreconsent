// SPDX-License-Identifier: MIT
import type {
  ConsentModeDefaults,
  ConsentModeMappingValue,
  GoogleSignal,
} from "./types";

/** Browser globals consumed by the inline Consent Mode head artifact. */
export interface ConsentModeHeadWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  libreconsentConsentMode?: unknown;
}

interface HeadConsentModeConfig {
  defaults: ConsentModeDefaults;
  mapping: Record<GoogleSignal, ConsentModeMappingValue>;
  waitForUpdate: number;
  adsDataRedaction: boolean;
  urlPassthrough: boolean;
}

const SIGNALS: GoogleSignal[] = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
];

const DEFAULT_MAPPING: Record<GoogleSignal, ConsentModeMappingValue> = {
  analytics_storage: "analytics",
  ad_storage: "marketing",
  ad_user_data: "marketing",
  ad_personalization: "marketing",
};

const deniedEverywhere: HeadConsentModeConfig = {
  defaults: "denied-everywhere",
  mapping: DEFAULT_MAPPING,
  waitForUpdate: 500,
  adsDataRedaction: false,
  urlPassthrough: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRegionalDefaults(
  value: unknown,
): value is { deniedRegions: string[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.deniedRegions) &&
    value.deniedRegions.every(
      (region) => typeof region === "string" && region.trim() !== "",
    )
  );
}

function normalizeMappingValue(value: unknown): ConsentModeMappingValue | null {
  if (typeof value === "string") {
    return value.trim() === "" ? null : value;
  }
  if (!isRecord(value)) {
    return null;
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("mode") ||
    !keys.includes("value") ||
    value.mode !== "fixed" ||
    value.value !== "denied"
  ) {
    return null;
  }
  for (const key in value) {
    if (key !== "mode" && key !== "value") {
      return null;
    }
  }
  return { mode: "fixed", value: "denied" };
}

function normalizeMapping(
  value: unknown,
): Record<GoogleSignal, ConsentModeMappingValue> | null {
  if (value === undefined) {
    return { ...DEFAULT_MAPPING };
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const signal of Object.keys(value)) {
    if (!SIGNALS.includes(signal as GoogleSignal)) {
      return null;
    }
  }

  const mapping: Record<GoogleSignal, ConsentModeMappingValue> = {
    ...DEFAULT_MAPPING,
  };
  for (const signal of SIGNALS) {
    if (value[signal] === undefined) continue;
    const normalized = normalizeMappingValue(value[signal]);
    if (normalized === null) {
      return null;
    }
    mapping[signal] = normalized;
  }
  return mapping;
}

function normalizeStandaloneConfig(
  value: unknown,
): HeadConsentModeConfig | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    return deniedEverywhere;
  }
  if (value.enabled === undefined || value.enabled === false) {
    return null;
  }
  if (value.enabled !== true) {
    return deniedEverywhere;
  }

  const defaults = value.defaults ?? "denied-everywhere";
  const waitForUpdate = value.waitForUpdate ?? 500;
  const adsDataRedaction = value.adsDataRedaction ?? false;
  const urlPassthrough = value.urlPassthrough ?? false;
  const mapping = normalizeMapping(value.mapping);

  if (
    (defaults !== "denied-everywhere" && !isRegionalDefaults(defaults)) ||
    typeof waitForUpdate !== "number" ||
    !Number.isInteger(waitForUpdate) ||
    waitForUpdate < 1 ||
    mapping === null ||
    typeof adsDataRedaction !== "boolean" ||
    typeof urlPassthrough !== "boolean"
  ) {
    return deniedEverywhere;
  }

  return {
    defaults:
      defaults === "denied-everywhere"
        ? defaults
        : {
            deniedRegions: defaults.deniedRegions.map((region) =>
              region.trim().toUpperCase(),
            ),
          },
    mapping,
    waitForUpdate,
    adsDataRedaction,
    urlPassthrough,
  };
}

function consentDefault(
  value: "denied" | "granted",
  mapping: Record<GoogleSignal, ConsentModeMappingValue>,
  waitForUpdate?: number,
  regions?: string[],
): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      SIGNALS.map((signal) => [
        signal,
        value === "granted" && typeof mapping[signal] !== "string"
          ? "denied"
          : value,
      ]),
    ),
    ...(waitForUpdate === undefined ? {} : { wait_for_update: waitForUpdate }),
    ...(regions === undefined ? {} : { region: regions }),
  };
}

/**
 * Queues Consent Mode defaults before Google configuration commands.
 *
 * This is intentionally internal: the IIFE head artifact invokes it directly.
 */
export function installConsentModeDefaults(
  target: ConsentModeHeadWindow,
): void {
  const config = normalizeStandaloneConfig(target.libreconsentConsentMode);
  if (config === null) {
    return;
  }

  const dataLayer = target.dataLayer ?? [];
  target.dataLayer = dataLayer;
  if (typeof target.gtag !== "function") {
    target.gtag = function gtag(): void {
      // biome-ignore lint/complexity/noArguments: Google’s standard gtag stub queues its arguments object.
      dataLayer.push(arguments);
    } as (...args: unknown[]) => void;
  }

  if (config.defaults === "denied-everywhere") {
    target.gtag(
      "consent",
      "default",
      consentDefault("denied", config.mapping, config.waitForUpdate),
    );
  } else {
    target.gtag(
      "consent",
      "default",
      consentDefault(
        "denied",
        config.mapping,
        config.waitForUpdate,
        config.defaults.deniedRegions,
      ),
    );
    target.gtag(
      "consent",
      "default",
      consentDefault("granted", config.mapping),
    );
  }
  if (config.adsDataRedaction) {
    target.gtag("set", "ads_data_redaction", true);
  }
  if (config.urlPassthrough) {
    target.gtag("set", "url_passthrough", true);
  }
}
