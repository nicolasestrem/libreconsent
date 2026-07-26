import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * Fixed by spec 03 §11.2. These endpoints must never be contacted before a
 * decision, in basic mode. Do not extend, narrow, or soften this list.
 */
const FORBIDDEN = [
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com/collect",
  "doubleclick.net",
] as const;

const ORIGIN = "http://127.0.0.1:4173";

/**
 * The genuine Google tag loader. Provenance is recorded in tests/vendor/README.md.
 * Serving it from disk keeps the flagship deterministic and CI egress-free while
 * still executing real Google code, as §11.2 requires.
 */
const GTAG_JS = readFileSync(join(__dirname, "vendor", "gtag.js"));

interface ConsentControls {
  acceptAll(): void;
  rejectAll(): void;
}

/** Runs in the page. Kept self-contained so `page.evaluate` can serialize it. */
function acceptAll(): void {
  const scoped = window as typeof window & { __lcApi?: ConsentControls };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  scoped.__lcApi.acceptAll();
}

/** Runs in the page. Kept self-contained so `page.evaluate` can serialize it. */
function rejectAll(): void {
  const scoped = window as typeof window & { __lcApi?: ConsentControls };
  if (!scoped.__lcApi) {
    throw new Error("libreconsent core did not initialize");
  }
  scoped.__lcApi.rejectAll();
}

function queuedCommands(): unknown[] {
  return (
    window as typeof window & {
      dataLayer: unknown[];
    }
  ).dataLayer.map((command) =>
    command !== null &&
    typeof command === "object" &&
    "length" in command &&
    typeof command.length === "number"
      ? Array.from(command as ArrayLike<unknown>)
      : command,
  );
}

function forbiddenHits(hits: string[]): string[] {
  return hits.filter((url) => FORBIDDEN.some((host) => url.includes(host)));
}

function loaderHits(hits: string[]): string[] {
  return hits.filter((url) => url.includes("googletagmanager.com"));
}

function isConsentCommand(command: unknown, action: string): boolean {
  return (
    Array.isArray(command) && command[0] === "consent" && command[1] === action
  );
}

/**
 * Records every request the page makes and keeps all third-party traffic offline.
 *
 * Interception covers `navigator.sendBeacon` as well as fetch/XHR, which is what
 * makes the negative assertions meaningful; the beacon guard below proves it.
 */
async function instrument(page: Page): Promise<string[]> {
  const hits: string[] = [];

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    hits.push(url);

    if (url.startsWith(ORIGIN)) {
      await route.continue();
      return;
    }
    if (url.includes("googletagmanager.com/gtag/js")) {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: GTAG_JS,
      });
      return;
    }
    if (
      url.includes("google-analytics.com") ||
      url.includes("analytics.google.com")
    ) {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.abort();
  });

  return hits;
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("/basic-site/");
  await page.waitForFunction(
    () =>
      (window as typeof window & { __lcApi?: unknown }).__lcApi !== undefined,
  );
}

/** Gives any late or deferred request a chance to be recorded before asserting. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

/**
 * Guards every "zero hits" assertion in this file. Analytics prefers
 * `navigator.sendBeacon`, so if interception ever stopped observing beacons the
 * silence assertions would pass while real traffic left the page.
 */
test("request interception observes navigator.sendBeacon", async ({ page }) => {
  const hits = await instrument(page);
  await page.goto("/basic-site/");

  const queued = await page.evaluate(() =>
    navigator.sendBeacon(
      "https://www.google-analytics.com/beacon-interception-probe",
      "probe",
    ),
  );
  await page.waitForTimeout(500);

  expect(queued).toBe(true);
  expect(hits.some((url) => url.includes("beacon-interception-probe"))).toBe(
    true,
  );
});

test("basic-site contacts no Google endpoint before a decision", async ({
  page,
}) => {
  const hits = await instrument(page);
  await openFixture(page);
  await settle(page);

  expect(forbiddenHits(hits)).toEqual([]);
  // The gated loader itself is never fetched in basic mode, which is stronger
  // than the fixed list requires and is the reason the silence holds.
  expect(loaderHits(hits)).toEqual([]);
  await expect(
    page.locator('script[data-cmp-category="analytics"]'),
  ).toHaveAttribute("type", "text/plain");
});

test("basic-site queues the consent default before any gtag command", async ({
  page,
}) => {
  const hits = await instrument(page);
  await openFixture(page);
  await settle(page);

  const commands = await page.evaluate(queuedCommands);

  expect(commands[0]).toEqual([
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
  expect(
    commands.filter((command) => isConsentCommand(command, "update")),
  ).toEqual([]);
  expect(forbiddenHits(hits)).toEqual([]);
});

test("accepting loads real gtag.js, grants the update, and lets collects through", async ({
  page,
}) => {
  const hits = await instrument(page);
  await openFixture(page);
  await settle(page);

  const collect = page.waitForRequest(
    (request) =>
      /google-analytics\.com|analytics\.google\.com/.test(request.url()) &&
      request.url().includes("collect"),
  );
  await page.evaluate(acceptAll);
  await collect;

  expect(hits.some((url) => url.includes("googletagmanager.com/gtag/js"))).toBe(
    true,
  );
  const commands = await page.evaluate(queuedCommands);
  const updates = commands.filter((command) =>
    isConsentCommand(command, "update"),
  );
  expect(updates).toContainEqual([
    "consent",
    "update",
    {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    },
  ]);
});

test("rejecting keeps the page silent and the loader unfetched", async ({
  page,
}) => {
  const hits = await instrument(page);
  await openFixture(page);
  await settle(page);

  await page.evaluate(rejectAll);
  await settle(page);

  expect(forbiddenHits(hits)).toEqual([]);
  expect(loaderHits(hits)).toEqual([]);
  const commands = await page.evaluate(queuedCommands);
  expect(commands).toContainEqual([
    "consent",
    "update",
    {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    },
  ]);
});
