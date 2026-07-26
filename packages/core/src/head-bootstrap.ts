import type { ConsentModeDefaults } from "./types";

/** Browser globals consumed by the inline Consent Mode head artifact. */
export interface ConsentModeHeadWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  libreconsentConsentMode?: unknown;
}

interface HeadConsentModeConfig {
  defaults: ConsentModeDefaults;
  waitForUpdate: number;
  adsDataRedaction: boolean;
  urlPassthrough: boolean;
}

const deniedEverywhere: HeadConsentModeConfig = {
  defaults: "denied-everywhere",
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

function normalizeStandaloneConfig(
  value: unknown,
): HeadConsentModeConfig | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    return deniedEverywhere;
  }
  if (value.enabled === false) {
    return null;
  }
  if (value.enabled !== true) {
    return deniedEverywhere;
  }

  const defaults = value.defaults ?? "denied-everywhere";
  const waitForUpdate = value.waitForUpdate ?? 500;
  const adsDataRedaction = value.adsDataRedaction ?? false;
  const urlPassthrough = value.urlPassthrough ?? false;

  if (
    (defaults !== "denied-everywhere" && !isRegionalDefaults(defaults)) ||
    typeof waitForUpdate !== "number" ||
    !Number.isInteger(waitForUpdate) ||
    waitForUpdate < 1 ||
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
    waitForUpdate,
    adsDataRedaction,
    urlPassthrough,
  };
}

function consentDefault(
  value: "denied" | "granted",
  waitForUpdate?: number,
  regions?: string[],
): Record<string, unknown> {
  return {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
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
      consentDefault("denied", config.waitForUpdate),
    );
  } else {
    target.gtag(
      "consent",
      "default",
      consentDefault(
        "denied",
        config.waitForUpdate,
        config.defaults.deniedRegions,
      ),
    );
    target.gtag("consent", "default", consentDefault("granted"));
  }
  if (config.adsDataRedaction) {
    target.gtag("set", "ads_data_redaction", true);
  }
  if (config.urlPassthrough) {
    target.gtag("set", "url_passthrough", true);
  }
}
