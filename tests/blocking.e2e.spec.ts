import { expect, type Page, test } from "@playwright/test";

interface ConsentControls {
  acceptAll(): void;
  withdraw(): void;
}

/** Runs in the page. Self-contained so `page.evaluate` can serialize it. */
function acceptAll(): void {
  const scoped = window as typeof window & { __lcApi?: ConsentControls };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  scoped.__lcApi.acceptAll();
}

/** Runs in the page. Self-contained so `page.evaluate` can serialize it. */
function withdraw(): void {
  const scoped = window as typeof window & { __lcApi?: ConsentControls };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  scoped.__lcApi.withdraw();
}

function executionOrder(): string[] {
  return (window as typeof window & { __order?: string[] }).__order ?? [];
}

function executedScripts(): string[] {
  return (window as typeof window & { __executed?: string[] }).__executed ?? [];
}

function cspViolations(): string[] {
  return (
    (window as typeof window & { __cspViolations?: string[] })
      .__cspViolations ?? []
  );
}

async function openFixture(page: Page, fixture: string): Promise<void> {
  await page.goto(`/${fixture}/`);
  await page.waitForFunction(
    () =>
      (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
  );
}

test("gated scripts stay inert until consent (BLK-1)", async ({ page }) => {
  await openFixture(page, "blocking-site");

  expect(await page.evaluate(executionOrder)).toEqual([]);
  await expect(
    page.locator('script[type="text/plain"][data-cmp-category="analytics"]'),
  ).toHaveCount(4);
});

test("consent executes gated scripts in document order (BLK-1)", async ({
  page,
}) => {
  await openFixture(page, "blocking-site");
  await page.evaluate(acceptAll);

  await expect.poll(() => page.evaluate(executionOrder)).toContain("inline-2");
  await expect.poll(() => page.evaluate(executionOrder)).toContain("async");

  const order = await page.evaluate(executionOrder);
  // `async` is deliberately unordered: preserving that is part of BLK-1.
  expect(order.filter((marker) => marker !== "async")).toEqual([
    "inline-1",
    "src-first",
    "inline-2",
  ]);
});

test("iframe embeds render an i18n placeholder and load only on consent (BLK-3)", async ({
  page,
}) => {
  await openFixture(page, "blocking-site");

  const iframe = page.locator("iframe[data-cmp-src]");
  const placeholder = page.locator("[data-libreconsent-placeholder]").first();

  await expect(iframe).toHaveCount(1);
  expect(await iframe.getAttribute("src")).toBeNull();
  await expect(iframe).toBeHidden();
  await expect(placeholder).toBeVisible();
  await expect(placeholder.locator("p")).toHaveText(
    "This content is blocked until you give consent.",
  );

  await placeholder.getByRole("button", { name: "Accept and load" }).click();

  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("src", "/blocking-site/embed.html");
  await expect(page.locator("[data-libreconsent-placeholder]")).toHaveCount(0);
  // The placeholder granted marketing only; analytics gates stay closed.
  expect(await page.evaluate(executionOrder)).toEqual([]);
});

test("generic placeholders hide their element until consent (BLK-3)", async ({
  page,
}) => {
  await openFixture(page, "blocking-site");

  const widget = page.locator("[data-cmp-placeholder]");
  await expect(widget).toBeHidden();

  await page.evaluate(acceptAll);

  await expect(widget).toBeVisible();
  await expect(page.locator("[data-libreconsent-placeholder]")).toHaveCount(0);
});

test("withdrawal re-blocks embeds but cannot un-execute scripts (BLK-5)", async ({
  page,
}) => {
  await openFixture(page, "blocking-site");
  await page.evaluate(acceptAll);

  const iframe = page.locator("iframe[data-cmp-src]");
  await expect(iframe).toHaveAttribute("src", "/blocking-site/embed.html");
  await expect.poll(() => page.evaluate(executionOrder)).toContain("inline-2");
  const executed = await page.evaluate(executionOrder);

  await page.evaluate(withdraw);

  await expect(iframe).toBeHidden();
  expect(await iframe.getAttribute("src")).toBeNull();
  await expect(
    page.locator("[data-libreconsent-placeholder]").first(),
  ).toBeVisible();
  expect(await page.evaluate(executionOrder)).toEqual(executed);
});

test("re-created scripts carry a nonce and satisfy CSP (BLK-2)", async ({
  page,
}) => {
  await openFixture(page, "csp-site");

  expect(await page.evaluate(executedScripts)).toEqual([]);

  await page.evaluate(acceptAll);

  await expect
    .poll(() => page.evaluate(executedScripts))
    .toEqual(["config-nonce", "element-nonce"]);
  expect(await page.evaluate(cspViolations)).toEqual([]);
});
