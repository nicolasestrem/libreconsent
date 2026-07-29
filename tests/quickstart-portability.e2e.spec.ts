// SPDX-License-Identifier: MIT
import { expect, type Page, test } from "@playwright/test";

type Quickstart = {
  assets: readonly string[];
  heading: string;
  kind: "bridge" | "core-ui" | "us";
  path: string;
};

type QuickstartWindow = typeof window & {
  LibreConsentBridge?: { initBridge?: unknown };
  LibreConsentCore?: { init?: unknown };
  LibreConsentUi?: { mount?: unknown };
};

const quickstarts: readonly Quickstart[] = [
  {
    assets: [
      "/vendor/libreconsent/core/index.global.js",
      "/vendor/libreconsent/ui/index.global.js",
    ],
    heading: "Basic Consent Mode quickstart",
    kind: "core-ui",
    path: "/quickstarts/basic-consent-mode/",
  },
  {
    assets: [
      "/vendor/libreconsent/core/index.global.js",
      "/vendor/libreconsent/ui/index.global.js",
    ],
    heading: "GTM basic-mode quickstart",
    kind: "core-ui",
    path: "/quickstarts/gtm-basic-mode/",
  },
  {
    assets: ["/vendor/libreconsent/bridge/index.global.js"],
    heading: "AdSense / Google Privacy & messaging bridge quickstart",
    kind: "bridge",
    path: "/quickstarts/adsense-bridge/",
  },
  {
    assets: [
      "/vendor/libreconsent/core/index.global.js",
      "/vendor/libreconsent/ui/index.global.js",
    ],
    heading: "US-only opt-out quickstart",
    kind: "us",
    path: "/quickstarts/us-only-opt-out/",
  },
];

function observePage(page: Page) {
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") {
      externalRequests.push(request.url());
    }
  });
  return { consoleErrors, externalRequests, pageErrors };
}

async function installTcfFixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__tcfapi", {
      configurable: true,
      value: (
        command: string,
        version: number,
        callback: (payload: unknown, success: boolean) => void,
      ) => {
        if (command === "addEventListener" && version === 2) {
          callback(
            {
              eventStatus: "tcloaded",
              gdprApplies: true,
              listenerId: 42,
              purpose: {
                consents: {
                  1: true,
                  2: false,
                  3: false,
                  4: false,
                  7: true,
                  8: true,
                  9: true,
                  10: true,
                },
              },
            },
            true,
          );
        }
      },
    });
  });
}

test("ordinary static serving exposes no legacy artifact alias or API", async ({
  page,
}) => {
  const [legacyArtifact, regionApi] = await Promise.all([
    page.request.get("/dist/core.global.js"),
    page.request.get("/api/region"),
  ]);

  expect(legacyArtifact.status()).toBe(404);
  expect(regionApi.status()).toBe(404);
});

for (const quickstart of quickstarts) {
  test(`${quickstart.heading} uses copied relative browser assets`, async ({
    page,
  }) => {
    if (quickstart.kind === "bridge") {
      await installTcfFixture(page);
    }
    const observed = observePage(page);

    for (const asset of quickstart.assets) {
      const response = await page.request.get(asset);
      expect(response.status()).toBe(200);
    }

    await page.goto(quickstart.path);
    await expect(
      page.getByRole("heading", { name: quickstart.heading }),
    ).toBeVisible();
    expect(
      await page
        .locator("script[src]")
        .evaluateAll((scripts) =>
          scripts.map((script) => script.getAttribute("src")),
        ),
    ).not.toEqual(expect.arrayContaining([expect.stringMatching(/^\/(?!\/)/)]));

    if (quickstart.kind === "bridge") {
      await expect(page.locator("#bridge-state")).toContainText(
        '"source": "tcf"',
      );
      expect(
        await page.evaluate(
          () =>
            typeof (window as QuickstartWindow).LibreConsentBridge
              ?.initBridge === "function",
        ),
      ).toBe(true);
    } else {
      await expect(
        page.getByRole("button", { name: "Accept all" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            typeof (window as QuickstartWindow).LibreConsentCore?.init ===
              "function" &&
            typeof (window as QuickstartWindow).LibreConsentUi?.mount ===
              "function",
        ),
      ).toBe(true);
    }

    if (quickstart.kind === "us") {
      await expect(page.locator("#analytics-status")).toHaveText("blocked");
      await expect(page.locator("#ads-status")).toHaveText("blocked");
    }

    if (quickstart.path === "/quickstarts/basic-consent-mode/") {
      await page.getByRole("button", { name: "Accept all" }).click();
      expect(
        await page.evaluate(() =>
          (
            window as typeof window & { dataLayer: ArrayLike<unknown>[] }
          ).dataLayer
            .map((entry) => Array.from(entry))
            .find((entry) => entry[0] === "consent" && entry[1] === "update"),
        ),
      ).toEqual([
        "consent",
        "update",
        {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ]);
    }

    const unexpectedConsoleErrors = observed.consoleErrors.filter(
      (message) =>
        quickstart.kind !== "us" ||
        !message.includes("the server responded with a status of 404"),
    );
    expect(unexpectedConsoleErrors).toEqual([]);
    expect(observed.externalRequests).toEqual([]);
    expect(observed.pageErrors).toEqual([]);
  });
}
