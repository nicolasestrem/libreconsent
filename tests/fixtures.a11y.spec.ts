import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixtures = [
  "basic-site",
  "bridge-site",
  "blocking-site",
  "csp-site",
  "dynamic-site",
  "gtm-site",
  "us-only-site",
  "quickstarts/basic-consent-mode",
  "quickstarts/gtm-basic-mode",
  "quickstarts/adsense-bridge",
  "quickstarts/us-only-opt-out",
  "demo-site",
] as const;

for (const fixture of fixtures) {
  test(`${fixture} has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await page.goto(`/${fixture}/`);

    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    );

    expect(blockingViolations).toEqual([]);
  });
}
