// SPDX-License-Identifier: MIT
import { expect, type Page, test } from "@playwright/test";

const releasePages = [
  ["/quickstarts/basic-consent-mode/", "Basic Consent Mode quickstart"],
  ["/quickstarts/gtm-basic-mode/", "GTM basic-mode quickstart"],
  [
    "/quickstarts/adsense-bridge/",
    "AdSense / Google Privacy & messaging bridge quickstart",
  ],
  ["/quickstarts/us-only-opt-out/", "US-only opt-out quickstart"],
  ["/demo-site/", "libreconsent local demo"],
] as const;

function errorsFor(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const [url, heading] of releasePages) {
  test(`${heading} compatibility smoke`, async ({ page }) => {
    const errors = errorsFor(page);
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1") {
        externalRequests.push(request.url());
      }
    });

    await page.goto(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
}
