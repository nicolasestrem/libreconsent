import { expect, type Page, test } from "@playwright/test";

/**
 * US state privacy behavior on `examples/us-only-site` (03 §7, §11.3).
 *
 * The fixture resolves `US-CA` and enables `usPrivacy`, so an undecided visitor
 * is treated as consenting until they opt out. Two things are therefore proved
 * here that no unit test can: that the gated ad script never fetches for an
 * opted-out visitor, and that the opt-out survives a reload.
 */

interface ConsentSnapshot {
  categories: Record<string, boolean>;
  gpcApplied?: boolean;
  implied?: boolean;
}

declare global {
  interface Window {
    /** Set by the fixture's gated `analytics.js`. */
    __analyticsRan?: boolean;
    /** Set by the fixture's gated `ads.js`, which an opt-out must prevent. */
    __adsRan?: boolean;
  }
}

/** Runs in the page before any other script, simulating a GPC-enabled browser. */
function defineGlobalPrivacyControl(): void {
  Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
    configurable: true,
    get: () => true,
  });
}

/** Runs in the page. Self-contained so `page.evaluate` can serialize it. */
function consentSnapshot(): ConsentSnapshot | null {
  const scoped = window as typeof window & {
    __lcApi?: { getConsent(): ConsentSnapshot | null };
  };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  return scoped.__lcApi.getConsent();
}

/**
 * Consent commands queued for Google, with `arguments` objects flattened.
 *
 * The head snippet's `gtag` stub pushes `arguments`, so each command arrives as
 * an array-like rather than an array.
 */
function consentCommands(): unknown[][] {
  const layer =
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? [];
  return layer
    .map((command) =>
      command !== null &&
      typeof command === "object" &&
      "length" in command &&
      typeof (command as ArrayLike<unknown>).length === "number"
        ? Array.from(command as ArrayLike<unknown>)
        : command,
    )
    .filter(
      (command): command is unknown[] =>
        Array.isArray(command) && command[0] === "consent",
    );
}

function ranFlags(): { analytics: boolean; ads: boolean } {
  const scoped = window as typeof window & {
    __analyticsRan?: boolean;
    __adsRan?: boolean;
  };
  return {
    analytics: scoped.__analyticsRan === true,
    ads: scoped.__adsRan === true,
  };
}

/** The `data-lc-action` of the focused control, descending through shadow roots. */
function focusedAction(): string | null {
  let current: Element | null = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current?.getAttribute("data-lc-action") ?? null;
}

function focusedId(): string {
  let current: Element | null = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current?.id ?? "";
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("/us-only-site/");
  await page.waitForFunction(
    () =>
      (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
  );
}

async function consentCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "libreconsent")?.value;
}

/** Tabs until `action` holds focus, so the journey stays keyboard-only. */
async function tabTo(page: Page, action: string): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    if ((await page.evaluate(focusedAction)) === action) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Never reached "${action}" by keyboard`);
}

test.describe("Global Privacy Control context (US-1)", () => {
  test.use({ contextOptions: { extraHTTPHeaders: { "Sec-GPC": "1" } } });

  test("auto-applies the sale/share opt-out without a banner", async ({
    page,
  }) => {
    await page.addInitScript(defineGlobalPrivacyControl);
    await openFixture(page);
    await page.waitForFunction(() => window.__analyticsRan === true);

    expect(await page.evaluate(consentSnapshot)).toMatchObject({
      implied: true,
      gpcApplied: true,
      categories: { necessary: true, analytics: true, marketing: false },
    });
    // No banner: the signal is the decision, so nothing is being asked (US-1).
    await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
    await expect(page.locator("[data-lc-optout]")).toHaveCount(0);
    // Re-entry stays available so the visitor can still change their mind.
    await expect(page.locator("[data-libreconsent-ui]")).toBeAttached();

    expect(await page.evaluate(ranFlags)).toEqual({
      analytics: true,
      ads: false,
    });
    expect(await page.evaluate(consentCommands)).toEqual([
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
      [
        "consent",
        "update",
        {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      ],
    ]);
    // Nothing is stored: the signal is re-read on every load (CORE-8).
    expect(await consentCookie(page)).toBeUndefined();
  });

  test("keeps the gated ad script from ever being requested", async ({
    page,
  }) => {
    const requested: string[] = [];
    await page.route("**/us-only-site/*.js", async (route) => {
      requested.push(new URL(route.request().url()).pathname);
      await route.continue();
    });
    await page.addInitScript(defineGlobalPrivacyControl);
    await openFixture(page);
    await page.waitForFunction(() => window.__analyticsRan === true);

    expect(requested).toContain("/us-only-site/analytics.js");
    expect(requested).not.toContain("/us-only-site/ads.js");
  });
});

test.describe("US opt-out without a signal (US-2, US-3)", () => {
  test("runs every gated script for an undecided visitor", async ({ page }) => {
    await openFixture(page);
    await page.waitForFunction(() => window.__adsRan === true);

    // The negative control for the GPC tests: without the signal the same
    // fixture grants everything, so their denials cannot be a false positive.
    expect(await page.evaluate(consentSnapshot)).toMatchObject({
      implied: true,
      categories: { analytics: true, marketing: true },
    });
    expect(await page.evaluate(consentSnapshot)).not.toHaveProperty(
      "gpcApplied",
    );
    expect(await page.evaluate(ranFlags)).toEqual({
      analytics: true,
      ads: true,
    });
    await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
    expect(await consentCookie(page)).toBeUndefined();
  });

  test("completes a keyboard-only opt-out that survives a reload", async ({
    page,
  }) => {
    await openFixture(page);
    await page.waitForFunction(() => window.__adsRan === true);

    await page.locator("#do-not-sell").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-lc-optout]")).toBeVisible();

    await tabTo(page, "opt-out");
    await page.keyboard.press("Enter");

    await expect(page.locator("[data-lc-optout]")).toHaveCount(0);
    expect(await page.evaluate(consentSnapshot)).toMatchObject({
      categories: { analytics: true, marketing: false },
    });
    expect(await page.evaluate(consentSnapshot)).not.toHaveProperty("implied");
    expect(await consentCookie(page)).toBeDefined();
    expect(await page.evaluate(consentCommands)).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);

    await page.reload();
    await page.waitForFunction(
      () =>
        (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
    );
    await page.waitForFunction(() => window.__analyticsRan === true);

    await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
    expect(await page.evaluate(ranFlags)).toEqual({
      analytics: true,
      ads: false,
    });
  });

  test("dismisses the dialog on Escape, restoring focus and storing nothing", async ({
    page,
  }) => {
    await openFixture(page);
    await page.waitForFunction(() => window.__adsRan === true);

    await page.locator("#do-not-sell").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-lc-optout]")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("[data-lc-optout]")).toHaveCount(0);
    expect(await page.evaluate(focusedId)).toBe("do-not-sell");
    expect(await consentCookie(page)).toBeUndefined();
    expect(await page.evaluate(consentSnapshot)).toMatchObject({
      categories: { marketing: true },
    });
  });

  test("reports an opt-out already in force when reopened", async ({
    page,
  }) => {
    await openFixture(page);
    await page.waitForFunction(() => window.__adsRan === true);
    await page.locator("#do-not-sell").click();
    await tabTo(page, "opt-out");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-lc-optout]")).toHaveCount(0);

    await page.locator("#do-not-sell").click();

    await expect(page.locator("[data-lc-optout]")).toBeVisible();
    await expect(
      page.locator('[data-lc-optout] [data-lc-action="opt-out"]'),
    ).toHaveCount(0);
  });
});
