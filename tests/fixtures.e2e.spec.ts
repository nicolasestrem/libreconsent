import { expect, test } from "@playwright/test";

const fixtures = ["basic-site", "gtm-site", "us-only-site"] as const;
const fixtureHeadings = {
  "basic-site": "Basic-site fixture",
  "gtm-site": "GTM-site fixture",
  "us-only-site": "US-only-site fixture",
} as const;

for (const fixture of fixtures) {
  test(`${fixture} is served as an accessible static fixture`, async ({
    page,
  }) => {
    await page.goto(`/${fixture}/`);

    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(fixtureHeadings[fixture]);
    await expect(page.locator(`[data-fixture="${fixture}"]`)).toBeVisible();
  });
}
