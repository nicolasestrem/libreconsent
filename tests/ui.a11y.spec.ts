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

  test(`the opt-out dialog is accessible in the ${scheme} theme (UI-3, US-2)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    // The US fixture, not basic-site: this dialog is only reachable where the
    // opt-out model applies, and it shows no banner to wait for.
    await page.goto("/us-only-site/");
    await page.locator("#do-not-sell").click();
    await expect(page.locator("[data-lc-optout]")).toBeVisible();

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

test("the settings button is accessible with its label revealed (UI-3, UI-5)", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Accept all" }).click();
  // The resting disc sits at reduced opacity and keeps its label hidden, so
  // auditing it collapsed would never exercise the label's contrast.
  const fab = page.getByRole("button", { name: "Cookie settings" });
  await fab.hover();
  await expect(page.locator(".lc-fab-label")).toHaveCSS("opacity", "1");

  expect(await blockingViolations(page)).toEqual([]);
});

test("the consent indicator survives forced colours (UI-3, UI-5)", async ({
  page,
}) => {
  // Forced colours override author background and border, so an indicator
  // distinguished only by theme tokens can collapse into one shape. Chromium
  // currently maps these two to distinct system colours unaided; this pins that
  // behaviour, because the state would otherwise be visible to everyone except
  // the high contrast users most likely to depend on it.
  await page.emulateMedia({ forcedColors: "active" });
  await openFixture(page);
  // Asserted, not assumed: if the emulation silently failed the comparison
  // below would run in ordinary colours, where the two states already differ,
  // and the test would pass while proving nothing.
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
  ).toBe(true);
  await page.getByRole("button", { name: "Reject all" }).click();

  const badge = () =>
    page
      .locator(".lc-fab-icon")
      .evaluate((node) => getComputedStyle(node, "::after").backgroundColor);
  const fab = page.getByRole("button", { name: "Cookie settings" });
  await expect(fab).toHaveAttribute("data-lc-consent", "essential");
  const essential = await badge();

  await page.evaluate(() => {
    (
      window as typeof window & { __lcApi: { acceptAll(): void } }
    ).__lcApi.acceptAll();
  });
  await expect(fab).toHaveAttribute("data-lc-consent", "extended");

  expect(await badge()).not.toBe(essential);
  // The name carries the state regardless of how the badge paints.
  await expect(fab).toHaveAttribute(
    "aria-label",
    "Cookie settings. Optional cookies allowed",
  );
});

test("reduced motion is honored on both layers (UI-3)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page);

  const transitions = await page
    .locator('[data-lc-banner] [data-lc-action="accept"]')
    .evaluate((node) => getComputedStyle(node).transitionDuration);

  expect(transitions).toBe("0s");
});
