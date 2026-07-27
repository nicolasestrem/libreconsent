import { expect, type Page, test } from "@playwright/test";

interface ConsentSnapshot {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
}

interface ConsentControls {
  getConsent(): ConsentSnapshot | null;
  showPreferences(): void;
}

/**
 * Accessible name of the focused element, resolved through shadow roots.
 *
 * Runs in the page and stays self-contained so `page.evaluate` can serialize
 * it. `document.activeElement` reports the shadow host, and the controls use
 * `aria-labelledby`, so neither the host nor `textContent` alone is enough.
 */
function focusedLabel(): string {
  let node: Element | null = document.activeElement;
  while (node?.shadowRoot?.activeElement) {
    node = node.shadowRoot.activeElement;
  }
  if (!node) {
    return "";
  }
  const labelledBy = node.getAttribute("aria-labelledby");
  if (labelledBy) {
    const root = node.getRootNode() as Document | ShadowRoot;
    return (
      labelledBy
        .split(/\s+/)
        .map((id) => root.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ")
        .trim() || ""
    );
  }
  return (
    node.getAttribute("aria-label")?.trim() ?? node.textContent?.trim() ?? ""
  );
}

function consentSnapshot(): ConsentSnapshot | null {
  const scoped = window as typeof window & { __lcApi?: ConsentControls };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  return scoped.__lcApi.getConsent();
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("/basic-site/");
  await page.waitForFunction(
    () =>
      (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
  );
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
}

/** Presses Tab until the focused control is `name`, never using the mouse. */
async function tabUntil(page: Page, name: string, max = 30): Promise<void> {
  for (let step = 0; step < max; step += 1) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(focusedLabel)) === name) {
      return;
    }
  }
  throw new Error(`"${name}" was not reachable with the keyboard`);
}

/** Computed properties that decide whether two buttons look equally weighted. */
function prominence(node: Element): Record<string, string> {
  const computed = getComputedStyle(node);
  return {
    tag: node.tagName,
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    fontSize: computed.fontSize,
    fontWeight: computed.fontWeight,
    padding: computed.padding,
    border: computed.border,
    opacity: computed.opacity,
    textDecorationLine: computed.textDecorationLine,
    textTransform: computed.textTransform,
    visibility: computed.visibility,
  };
}

test("keyboard alone completes the accept journey (UI-1, UI-3)", async ({
  page,
}) => {
  await openFixture(page);

  await tabUntil(page, "Accept all");
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
  const consent = await page.evaluate(consentSnapshot);
  expect(consent?.categories).toMatchObject({
    necessary: true,
    analytics: true,
    marketing: true,
  });
  expect(consent?.services).toMatchObject({ ga4: true, "google-ads": true });
});

test("keyboard alone completes the reject journey (UI-1, UI-3)", async ({
  page,
}) => {
  await openFixture(page);

  await tabUntil(page, "Reject all");
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
  const consent = await page.evaluate(consentSnapshot);
  expect(consent?.categories).toMatchObject({
    necessary: true,
    analytics: false,
    marketing: false,
  });
  expect(consent?.services).toMatchObject({ ga4: false, "google-ads": false });
});

test("keyboard alone saves a per-service choice in the second layer (UI-2, UI-3)", async ({
  page,
}) => {
  await openFixture(page);

  await tabUntil(page, "Customize");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();

  await tabUntil(page, "Google Analytics 4");
  await page.keyboard.press("Space");
  await tabUntil(page, "Save choices");
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-lc-preferences]")).toHaveCount(0);
  const consent = await page.evaluate(consentSnapshot);
  expect(consent?.services).toMatchObject({ ga4: true, "google-ads": false });
  expect(consent?.categories).toMatchObject({
    analytics: true,
    marketing: false,
  });
});

test("accept and reject are rendered with equal prominence (UI-1, UI-7)", async ({
  page,
}) => {
  await openFixture(page);

  const banner = page.locator("[data-lc-banner]");
  const accept = banner.locator('[data-lc-action="accept"]');
  const reject = banner.locator('[data-lc-action="reject"]');

  const acceptStyle = await accept.evaluate(prominence);
  expect(await reject.evaluate(prominence)).toEqual(acceptStyle);

  // Guards the comparison above: two identically unstyled buttons would match
  // each other while looking nothing like a real call to action.
  expect(acceptStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(acceptStyle.backgroundColor).not.toBe("transparent");

  const acceptBox = await accept.boundingBox();
  const rejectBox = await reject.boundingBox();
  expect(rejectBox?.width).toBeCloseTo(acceptBox?.width ?? 0, 0);
  expect(rejectBox?.height).toBeCloseTo(acceptBox?.height ?? 0, 0);

  // Both sit in the same action group, so no layout can bury one of them.
  expect(
    await reject.evaluate(
      (node, acceptSelector) =>
        node.parentElement ===
        (node.getRootNode() as ShadowRoot).querySelector(acceptSelector)
          ?.parentElement,
      '[data-lc-action="accept"]',
    ),
  ).toBe(true);
});

test("the second layer pre-checks nothing optional (UI-7)", async ({
  page,
}) => {
  await openFixture(page);

  await page.getByRole("button", { name: "Customize" }).click();

  const checkboxes = page.locator("[data-lc-preferences] input[type=checkbox]");
  await expect(checkboxes).not.toHaveCount(0);
  for (const box of await checkboxes.all()) {
    await expect(box).not.toBeChecked();
  }
  // `necessary` is readonly, so it is stated rather than offered as a control.
  await expect(
    page.locator('[data-lc-category="necessary"] input[type=checkbox]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-lc-category="necessary"]')).toContainText(
    "Always on",
  );
});

test("preferences trap focus, close on Escape, and restore focus (UI-3)", async ({
  page,
}) => {
  await openFixture(page);

  await tabUntil(page, "Customize");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();

  // Focus starts inside the dialog and Shift+Tab from the first control wraps
  // to the last rather than escaping to the page behind.
  expect(await page.evaluate(focusedLabel)).toBe("Close");
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(focusedLabel)).toBe("Reject all");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(focusedLabel)).toBe("Close");

  await page.keyboard.press("Escape");

  await expect(page.locator("[data-lc-preferences]")).toHaveCount(0);
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
  expect(await page.evaluate(focusedLabel)).toBe("Customize");
});

test("cookie tables disclose per service on demand (UI-2)", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Customize" }).click();

  const disclose = page.getByRole("button", { name: "Show cookies" }).first();
  await expect(disclose).toHaveAttribute("aria-expanded", "false");
  await disclose.click();

  await expect(
    page.getByRole("button", { name: "Hide cookies" }).first(),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("cell", { name: "_ga", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Distinguishes visitors." }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Duration" }),
  ).toBeVisible();
});

test("re-entry reopens preferences after a decision (UI-5)", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("[data-lc-banner]")).toHaveCount(0);

  // The host page binding.
  await page.getByRole("button", { name: "Cookie preferences" }).click();
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();
  // Saved choices are reflected back into the controls.
  await expect(
    page.locator("[data-lc-preferences] input[type=checkbox]").first(),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close" }).click();

  // The persistent floating button.
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();
  await page.keyboard.press("Escape");

  // The core intent, now fulfilled by the registered renderer.
  await page.evaluate(() => {
    (
      window as typeof window & { __lcApi: ConsentControls }
    ).__lcApi.showPreferences();
  });
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();
});

test("the banner renders in a shadow root and honors theme tokens (UI-4, UI-6)", async ({
  page,
}) => {
  await openFixture(page);

  expect(
    await page.evaluate(
      () =>
        document.querySelector("[data-libreconsent-ui]")?.shadowRoot !== null,
    ),
  ).toBe(true);

  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      "--libreconsent-accent",
      "rgb(1, 2, 3)",
    );
  });

  await expect(
    page.locator('[data-lc-banner] [data-lc-action="accept"]'),
  ).toHaveCSS("background-color", "rgb(1, 2, 3)");
});

test("the rendered surface declares its language (UI-8)", async ({ page }) => {
  await openFixture(page);

  await expect(page.locator("[data-libreconsent-ui]")).toHaveAttribute(
    "lang",
    "en",
  );
});

test("a restored decision shows no banner (UI-7)", async ({ page }) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Reject all" }).click();
  await expect(page.locator("[data-lc-banner]")).toHaveCount(0);

  await page.reload();
  await page.waitForFunction(
    () =>
      (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
  );
  await expect(
    page.getByRole("button", { name: "Cookie settings" }),
  ).toBeVisible();

  await expect(page.locator("[data-lc-banner]")).toHaveCount(0);
});
