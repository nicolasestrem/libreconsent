// SPDX-License-Identifier: MIT
import { expect, type Page, test } from "@playwright/test";

function observePage(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
  });
  return { consoleErrors, externalRequests, pageErrors };
}

test("basic quickstart gates its loader and updates Consent Mode", async ({
  page,
}) => {
  const observed = observePage(page);
  await page.goto("/quickstarts/basic-consent-mode/");

  expect(
    await page.evaluate(() => {
      const commands = (
        window as typeof window & { dataLayer: ArrayLike<unknown>[] }
      ).dataLayer;
      return Array.from(commands[0] ?? []);
    }),
  ).toEqual([
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
  await expect(page.locator("#analytics-status")).toHaveText("blocked");

  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#analytics-status")).toHaveText(
    "loaded after consent",
  );
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { dataLayer: ArrayLike<unknown>[] }
      ).dataLayer.map((entry) => Array.from(entry)),
    ),
  ).toContainEqual([
    "consent",
    "update",
    {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    },
  ]);
  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});

test("GTM quickstart queues defaults before container initialization", async ({
  page,
}) => {
  const observed = observePage(page);
  await page.goto("/quickstarts/gtm-basic-mode/");

  const commands = await page.evaluate(() =>
    (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer.map((entry) =>
      entry && typeof entry === "object" && "length" in entry
        ? Array.from(entry)
        : entry,
    ),
  );
  expect(commands[0]).toEqual([
    "consent",
    "default",
    expect.objectContaining({
      analytics_storage: "denied",
      ad_user_data: "denied",
    }),
  ]);
  expect(commands[1]).toEqual(expect.objectContaining({ event: "gtm.js" }));
  await expect(page.locator("#gtm-status")).toHaveText("blocked");

  await page.getByRole("button", { name: "Reject all" }).click();
  await expect(page.locator("#gtm-status")).toHaveText("blocked");
  await page.evaluate(() =>
    (
      window as typeof window & {
        __quickstartApi: { acceptAll(): void };
      }
    ).__quickstartApi.acceptAll(),
  );
  await expect(page.locator("#gtm-status")).toHaveText("loaded after consent");
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & {
          dataLayer: Array<{ event?: string }>;
        }
      ).dataLayer.some((entry) => entry.event === "local-container-loaded"),
    ),
  ).toBe(true);
  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});

test("AdSense bridge quickstart remains a read-only TCF consumer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const listeners = new Map<
      number,
      (payload: unknown, success: boolean) => void
    >();
    Object.defineProperty(window, "__tcfapi", {
      configurable: true,
      value: (
        command: string,
        version: number,
        callback: (payload: unknown, success: boolean) => void,
        parameter?: number,
      ) => {
        if (command === "addEventListener" && version === 2) {
          listeners.set(42, callback);
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
        if (command === "removeEventListener") {
          callback(listeners.delete(parameter ?? -1), true);
        }
      },
    });
  });
  const observed = observePage(page);
  await page.goto("/quickstarts/adsense-bridge/");

  await expect(page.locator("#bridge-state")).toContainText('"source": "tcf"');
  await expect(page.locator("#bridge-state")).toContainText(
    '"analytics": true',
  );
  await expect(page.locator("#bridge-state")).toContainText(
    '"marketing": false',
  );
  await expect(page.locator("[data-libreconsent-ui]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => typeof (window as typeof window & { __tcfapi?: unknown }).__tcfapi,
    ),
  ).toBe("function");
  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});

test("US quickstart resolves region same-origin and exposes opt-out", async ({
  page,
}) => {
  const observed = observePage(page);
  await page.goto("/quickstarts/us-only-opt-out/");

  await expect(page.locator("#analytics-status")).toHaveText("active");
  await expect(page.locator("#ads-status")).toHaveText("active");
  await expect(page.locator("[data-libreconsent-ui]")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      cookie: document.cookie,
      local: localStorage.getItem("libreconsent"),
    })),
  ).toEqual({ cookie: "", local: null });

  await page.getByRole("link", { name: /Do Not Sell/ }).click();
  await page.getByRole("button", { name: "Opt out" }).click();
  expect(
    await page.evaluate(() => {
      const consent = (
        window as typeof window & {
          __quickstartApi: {
            getConsent(): { categories: Record<string, boolean> } | null;
          };
        }
      ).__quickstartApi.getConsent();
      return consent?.categories.marketing;
    }),
  ).toBe(false);
  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});

test("US quickstart honors GPC before advertising can load", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
  });
  const observed = observePage(page);
  await page.goto("/quickstarts/us-only-opt-out/");

  await expect(page.locator("#analytics-status")).toHaveText("active");
  await expect(page.locator("#ads-status")).toHaveText("blocked");
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __quickstartAdsLoaded?: boolean;
          }
        ).__quickstartAdsLoaded,
    ),
  ).toBeUndefined();
  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});

test("local demo supports customization, withdrawal, and re-entry", async ({
  page,
}) => {
  const observed = observePage(page);
  await page.goto("/demo-site/");

  await expect(page.locator("#consent-state")).toHaveText("No active decision");
  await expect(page.locator("#local-script-status")).toHaveText(
    "Analytics script is blocked.",
  );

  await page.getByRole("button", { name: "Customize" }).click();
  await page.getByRole("checkbox", { name: "Analytics" }).check();
  await page.getByRole("button", { name: "Save choices" }).click();
  await expect(page.locator("#local-script-status")).toHaveText(
    "Analytics script loaded after consent.",
  );
  await expect(page.locator("#consent-state")).toContainText(
    '"analytics": true',
  );
  await expect(page.locator("#consent-state")).toContainText(
    '"marketing": false',
  );

  await page.getByRole("button", { name: "Open privacy preferences" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy preferences" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await expect(page.locator("#consent-state")).toContainText(
    '"analytics": false',
  );
  await page.getByRole("button", { name: "Open privacy preferences" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy preferences" }),
  ).toBeVisible();

  expect(observed).toEqual({
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
  });
});
