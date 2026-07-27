import { expect, test } from "@playwright/test";

const fixtures = [
  "basic-site",
  "bridge-site",
  "blocking-site",
  "csp-site",
  "dynamic-site",
  "gtm-site",
  "us-only-site",
] as const;
const fixtureHeadings = {
  "basic-site": "Basic-site fixture",
  "bridge-site": "Bridge-site fixture",
  "blocking-site": "Blocking-site fixture",
  "csp-site": "CSP-site fixture",
  "dynamic-site": "Dynamic-site fixture",
  "gtm-site": "GTM-site fixture",
  "us-only-site": "US-only-site fixture",
} as const;

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

test("basic-site queues the compiled consent default before js and config", async ({
  page,
}) => {
  await page.goto("/basic-site/");

  await expect(
    page.locator("script[data-libreconsent-head-artifact]"),
  ).toHaveCount(1);
  const commands = await page.evaluate(queuedCommands);

  expect(commands).toHaveLength(3);
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
  // The `js` argument is a real Date because the fixture now loads real
  // gtag.js, so its value cannot be pinned — only its position and shape.
  const [jsCommand, jsTimestamp] = commands[1] as [unknown, unknown];
  expect(jsCommand).toBe("js");
  expect(jsTimestamp).toBeInstanceOf(Date);
  expect(commands[2]).toEqual(["config", "G-BASIC"]);
});

test("gtm-site queues every default before its Consent Initialization marker", async ({
  page,
}) => {
  await page.goto("/gtm-site/");

  await expect(
    page.locator("script[data-libreconsent-head-artifact]"),
  ).toHaveCount(1);
  const commands = await page.evaluate(queuedCommands);

  expect(commands).toEqual([
    [
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
        region: ["FR", "US-CA"],
      },
    ],
    [
      "consent",
      "default",
      {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      },
    ],
    { event: "consent-initialization" },
  ]);
});
