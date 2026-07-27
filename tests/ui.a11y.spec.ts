import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** Violation shape, taken from the builder so `axe-core` need not be a direct dependency. */
type Violation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

/**
 * Phase 4 gate (spec §11.4): zero critical or serious violations on both
 * consent layers, in light and dark themes.
 *
 * `fixtures.a11y.spec.ts` scans the fixtures as delivered; this file drives the
 * UI into each state a visitor actually sees, because a banner that is never
 * opened cannot be audited.
 */
async function blockingViolations(page: Page): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("/basic-site/");
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
}

for (const scheme of ["light", "dark"] as const) {
  test(`the banner is accessible in the ${scheme} theme (UI-3, UI-4)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openFixture(page);

    expect(await blockingViolations(page)).toEqual([]);
  });

  test(`the preferences modal is accessible in the ${scheme} theme (UI-3, UI-4)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openFixture(page);
    await page.getByRole("button", { name: "Customize" }).click();
    await expect(page.locator("[data-lc-preferences]")).toBeVisible();
    // Cookie tables are collapsed by default, so disclose one to audit it.
    await page.getByRole("button", { name: "Show cookies" }).first().click();
    await expect(page.getByRole("table").first()).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });
}

test("the persistent settings button is accessible (UI-3, UI-5)", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(
    page.getByRole("button", { name: "Cookie settings" }),
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("reduced motion is honored on both layers (UI-3)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page);

  const transitions = await page
    .locator('[data-lc-banner] [data-lc-action="accept"]')
    .evaluate((node) => getComputedStyle(node).transitionDuration);

  expect(transitions).toBe("0s");
});
