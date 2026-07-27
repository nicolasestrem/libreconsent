import { expect, test } from "@playwright/test";

/**
 * Non-functional gates that are properties of the whole page rather than of one
 * requirement's behavior (03 §10).
 *
 * The size budgets (NFR-1) are enforced by `pnpm size` against the real built
 * artifacts, and the zero-network guarantee (NFR-2, NFR-3) by
 * `tests/pre-consent-network-silence.e2e.spec.ts` and
 * `scripts/guardrails.test.mjs`. What is left, and what needs a real browser, is
 * layout stability.
 */

interface LayoutShift {
  value: number;
  startTime: number;
  sources: string[];
}

declare global {
  interface Window {
    __layoutShifts?: LayoutShift[];
    __lcApi?: { showPreferences(): void };
  }
}

/**
 * Runs in the page before any other script.
 *
 * `buffered: true` replays shifts recorded before the observer was created, so
 * nothing between navigation and banner paint can escape it. Shifts following
 * real user input are excluded exactly as the Core Web Vitals definition does:
 * a shift the visitor caused by clicking is not an unexpected one.
 */
function recordLayoutShifts(): void {
  window.__layoutShifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
        sources?: { node?: Node }[];
      };
      if (shift.hadRecentInput === true) {
        continue;
      }
      window.__layoutShifts?.push({
        value: shift.value ?? 0,
        startTime: entry.startTime,
        // Named so a failure says which element moved, not just that CLS > 0.
        sources: (shift.sources ?? []).map((source) => {
          const node = source.node;
          return node instanceof Element
            ? `${node.tagName.toLowerCase()}${node.getAttribute("data-lc-banner") === null ? "" : "[data-lc-banner]"}`
            : "unknown";
        }),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
}

function layoutShifts(): LayoutShift[] {
  return window.__layoutShifts ?? [];
}

/** Resolves after two frames, by which point any shift has been recorded. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

test("banner and preferences injection shift no layout (NFR-2)", async ({
  page,
}) => {
  await page.addInitScript(recordLayoutShifts);

  await page.goto("/basic-site/");
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
  await page.evaluate(settle);

  // Both consent surfaces are fixed-position overlays, so they are painted over
  // the document instead of displacing it. Asserting the entries rather than a
  // summed score means a regression reports which element moved and when.
  expect(await page.evaluate(layoutShifts)).toEqual([]);

  await page.evaluate(() => {
    window.__lcApi?.showPreferences();
  });
  await expect(page.locator("[data-lc-preferences]")).toBeVisible();
  await page.evaluate(settle);

  expect(await page.evaluate(layoutShifts)).toEqual([]);
});

test("the layout-shift observer would catch a shift if one happened", async ({
  page,
}) => {
  await page.addInitScript(recordLayoutShifts);
  await page.goto("/basic-site/");
  await expect(page.locator("[data-lc-banner]")).toBeVisible();
  await page.evaluate(settle);

  // Without this the zero-shift assertion above could pass simply because the
  // observer never worked, on a browser that never emits the entry type, or
  // through a typo in the entry name. Displacing real content proves otherwise.
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "400px";
    document.body.prepend(spacer);
  });
  await page.evaluate(settle);

  const shifts = await page.evaluate(layoutShifts);
  expect(shifts.length).toBeGreaterThan(0);
  expect(shifts.some((shift) => shift.value > 0)).toBe(true);
});
