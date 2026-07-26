import { describe, expect, test } from "vitest";
import { installConsentModeDefaults } from "./head-bootstrap";

interface TestWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  libreconsentConsentMode?: unknown;
}

function commands(target: TestWindow): unknown[][] {
  return (target.dataLayer ?? []).map((command) =>
    Array.from(command as ArrayLike<unknown>),
  );
}

describe("Consent Mode head bootstrap (CM-1, CM-3)", () => {
  test("is side-effect-free when bootstrap input is absent or disabled", () => {
    const target: TestWindow = {};
    const disabled: TestWindow = {
      libreconsentConsentMode: { enabled: false },
    };

    installConsentModeDefaults(target);
    installConsentModeDefaults(disabled);

    expect(target).toEqual({});
    expect(disabled).toEqual({ libreconsentConsentMode: { enabled: false } });
  });

  test("queues a denied default as the first data-layer command", () => {
    const target: TestWindow = {
      libreconsentConsentMode: { enabled: true },
    };

    installConsentModeDefaults(target);

    expect(commands(target)).toEqual([
      [
        "consent",
        "default",
        {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          wait_for_update: 500,
        },
      ],
    ]);
  });

  test("queues regional denial, global grant, and configured settings in order", () => {
    const target: TestWindow = {
      dataLayer: [],
      libreconsentConsentMode: {
        enabled: true,
        defaults: { deniedRegions: ["fr", "US-CA"] },
        waitForUpdate: 750,
        adsDataRedaction: true,
        urlPassthrough: true,
      },
    };

    installConsentModeDefaults(target);

    expect(commands(target)).toEqual([
      [
        "consent",
        "default",
        {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          wait_for_update: 750,
          region: ["FR", "US-CA"],
        },
      ],
      [
        "consent",
        "default",
        {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        },
      ],
      ["set", "ads_data_redaction", true],
      ["set", "url_passthrough", true],
    ]);
  });

  test("fails closed for invalid standalone bootstrap values", () => {
    const target: TestWindow = {
      libreconsentConsentMode: { enabled: true, waitForUpdate: 0 },
    };

    installConsentModeDefaults(target);

    expect(commands(target)[0]).toEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      },
    ]);
  });
});
