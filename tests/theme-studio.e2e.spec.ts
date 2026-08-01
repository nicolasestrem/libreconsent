import { expect, type Page, test } from "@playwright/test";

/**
 * Sets a color token through its `<input type="color">` by writing the value
 * and dispatching `input`, mirroring how the studio's own change handler reads
 * it. Robust across Playwright color-input quirks.
 */
async function setColor(page: Page, token: string, hex: string): Promise<void> {
  await page.locator(`[data-studio="${token}"]`).evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, hex);
}

/** Navigates to the studio and waits for the banner to mount. */
async function openStudio(page: Page): Promise<void> {
  await page.goto("/theme-studio/");
  await studioReady(page);
}

/** Waits for the studio globals and a visible banner without navigating. */
async function studioReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as Window & { __studio?: unknown }).__studio !== undefined,
  );
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
}

test.describe("Theme Studio", () => {
  test("a color token flows to the banner and the CSS export", async ({
    page,
  }) => {
    await openStudio(page);

    await setColor(page, "accent", "#010203");

    await expect(
      page.locator('[data-lc-banner] [data-lc-action="accept"]'),
    ).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(page.locator('[data-studio="export-css"]')).toContainText(
      "--libreconsent-accent: #010203",
    );
  });

  test("a layout card remounts the banner in the chosen layout", async ({
    page,
  }) => {
    await openStudio(page);

    await page.locator('[data-studio-layout="modal"]').click();

    await expect(page.locator("[data-lc-banner]")).toHaveAttribute(
      "data-layout",
      "modal",
    );
    await expect(page.locator('[data-studio="export-js"]')).toContainText(
      'layout: "modal"',
    );
  });

  test("a preset applies its full palette", async ({ page }) => {
    await openStudio(page);

    await page.locator('[data-preset="terminal"]').click();

    await expect(page.locator("[data-lc-banner]")).toHaveCSS(
      "background-color",
      "rgb(10, 15, 10)",
    );
    await expect(page.locator('[data-studio="export-css"]')).toContainText(
      "--libreconsent-radius: 0px",
    );
  });

  test("the share link round-trips the full state", async ({ page }) => {
    await openStudio(page);

    await setColor(page, "bg", "#123456");
    const hash = await page.evaluate(() => location.hash);

    await page.goto(`/theme-studio/${hash}`);
    await studioReady(page);

    await expect(page.locator('[data-studio="bg"]')).toHaveValue("#123456");
    await expect(page.locator("[data-lc-banner]")).toHaveCSS(
      "background-color",
      "rgb(18, 52, 86)",
    );
  });

  test("the contrast badge fails and passes with the accent pair", async ({
    page,
  }) => {
    await openStudio(page);

    await setColor(page, "accent", "#ffff00");
    await setColor(page, "accent-fg", "#ffffff");
    await expect(page.locator('[data-contrast="accent"]')).toHaveAttribute(
      "data-state",
      "fail",
    );

    await setColor(page, "accent-fg", "#000000");
    await expect(page.locator('[data-contrast="accent"]')).toHaveAttribute(
      "data-state",
      "pass",
    );
  });

  test("restart preview brings the banner back after a decision", async ({
    page,
  }) => {
    await openStudio(page);

    await page.locator('[data-lc-banner] [data-lc-action="accept"]').click();
    await expect(page.locator("[data-lc-banner]")).toBeHidden();
    await expect(page.locator(".lc-fab")).toBeVisible();

    await page.locator('[data-studio="restart"]').click();
    await expect(page.locator("[data-lc-banner]")).toBeVisible();
  });

  test("switching locale remounts with translated strings", async ({
    page,
  }) => {
    await openStudio(page);

    await page.locator('[data-studio-locale="fr"]').click();

    await expect(
      page.locator('[data-lc-banner] [data-lc-action="accept"]'),
    ).toContainText("Tout accepter");
  });

  test("reset all restores defaults and clears overrides", async ({ page }) => {
    await openStudio(page);

    await page.locator('[data-studio-layout="modal"]').click();
    await setColor(page, "accent", "#010203");
    await expect(page.locator("[data-lc-banner]")).toHaveAttribute(
      "data-layout",
      "modal",
    );

    await page.locator('[data-studio="reset-all"]').click();

    await expect(page.locator("[data-lc-banner]")).toHaveAttribute(
      "data-layout",
      "bar-bottom",
    );
    await expect(page.locator('[data-studio="export-css"]')).toContainText(
      "Using library defaults",
    );
  });

  test("the Do-Not-Sell control opens the opt-out dialog", async ({ page }) => {
    await openStudio(page);

    await page.locator('[data-studio="open-optout"]').click();

    await expect(page.locator("[data-lc-optout]")).toBeVisible();
  });

  test("the overlay color takes effect without touching opacity", async ({
    page,
  }) => {
    await openStudio(page);

    await setColor(page, "overlay", "#102030");

    await expect(page.locator('[data-studio="export-css"]')).toContainText(
      "--libreconsent-overlay: rgba(16, 32, 48, 0.55)",
    );
  });

  test("font-size control reflects the library default", async ({ page }) => {
    await openStudio(page);

    await expect(page.locator('[data-studio="font-size"]')).toHaveValue("15");
  });

  test("auto theme follows system color-scheme changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openStudio(page);

    await expect(page.locator('[data-studio="overlay"]')).toHaveValue(
      "#101217",
    );

    await page.emulateMedia({ colorScheme: "dark" });

    await expect(page.locator('[data-studio="overlay"]')).toHaveValue(
      "#000000",
    );
    await expect(page.locator('[data-studio="overlay-alpha"]')).toHaveValue(
      "65",
    );
  });
});
