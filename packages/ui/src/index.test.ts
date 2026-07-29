// SPDX-License-Identifier: MIT
import type {
  CmpConfig,
  ConsentApi,
  ConsentState,
  ReadyEvent,
} from "@libreconsent/core";
import { init } from "@libreconsent/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { activeElement, focusable } from "./focus";
import { mount, type UiHandle } from "./index";
import type { UiOptions } from "./options";

const HOSTILE_LABEL = '<img src=x onerror="alert(1)">';

const dictionary = {
  "category.analytics.label": "Analytics",
  "category.analytics.description": "Analytics description",
  "category.marketing.label": "Marketing",
  "category.marketing.description": "Marketing description",
  "category.functional.label": "Functional",
  "category.functional.description": "Functional description",
  "category.regional.label": "Regional",
  "category.regional.description": "Regional description",
  "service.ga.label": "Google Analytics",
  "service.amp.label": "Amplitude",
  "service.ads.label": "Advertising",
  "service.frOnly.label": "French service",
  "service.deOnly.label": "German service",
  "service.usOnly.label": "American service",
  "cookie.ga.purpose": "Measure site usage",
  "cookie.ga.provider": "Google",
  "cookie.ga.duration": "Two years",
  "cookie.ga.type": "HTTP cookie",
  "cookie.gid.purpose": "Distinguish visitors",
};

function baseConfig(overrides: Partial<CmpConfig> = {}): CmpConfig {
  return {
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
        services: [
          {
            id: "ga",
            label: "service.ga.label",
            cookies: [
              {
                name: "_ga",
                purpose: "cookie.ga.purpose",
                provider: "cookie.ga.provider",
                duration: "cookie.ga.duration",
                type: "cookie.ga.type",
              },
              { name: "_gid", purpose: "cookie.gid.purpose" },
            ],
          },
          { id: "amp", label: "service.amp.label" },
        ],
      },
      {
        id: "marketing",
        label: "category.marketing.label",
        description: "category.marketing.description",
        services: [{ id: "ads", label: "service.ads.label" }],
      },
      {
        id: "functional",
        label: "category.functional.label",
        description: "category.functional.description",
      },
    ],
    i18n: { default: "en", translations: { en: dictionary } },
    ...overrides,
  };
}

/**
 * A configuration whose services are region-gated, driven by a resolver that
 * always reports France.
 */
function regionConfig(): CmpConfig {
  return baseConfig({
    resolveRegion: async () => "FR",
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
        services: [
          { id: "ga", label: "service.ga.label" },
          {
            id: "frOnly",
            label: "service.frOnly.label",
            onlyRegions: ["FR"],
          },
          {
            id: "deOnly",
            label: "service.deOnly.label",
            onlyRegions: ["DE"],
          },
        ],
      },
      {
        id: "regional",
        label: "category.regional.label",
        description: "category.regional.description",
        services: [
          {
            id: "usOnly",
            label: "service.usOnly.label",
            onlyRegions: ["US"],
          },
        ],
      },
    ],
  });
}

function storedState(overrides: Partial<ConsentState> = {}): ConsentState {
  const timestamp = new Date().toISOString();
  return {
    consentId: "9d235664-2d3d-4db5-8117-36c0ac57e920",
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    categories: {
      necessary: true,
      analytics: true,
      marketing: false,
      functional: false,
    },
    services: { ga: true, amp: false, ads: false },
    ...overrides,
  };
}

function storeState(state: ConsentState): void {
  window.localStorage.setItem(
    "libreconsent",
    encodeURIComponent(JSON.stringify(state)),
  );
}

const activeApis = new Set<ConsentApi>();
const activeHandles = new Set<UiHandle>();

function start(config: CmpConfig): ConsentApi {
  const api = init(config);
  activeApis.add(api);
  return api;
}

function waitForReady(api: ConsentApi): Promise<ReadyEvent> {
  return new Promise((resolve) => {
    api.on("ready", resolve);
  });
}

interface MountedUi {
  api: ConsentApi;
  handle: UiHandle;
}

/** Initializes the core, mounts the renderer, and waits for `ready`. */
async function render(
  config: CmpConfig = baseConfig(),
  options?: UiOptions,
): Promise<MountedUi> {
  const api = start(config);
  const handle = mount(api, options);
  activeHandles.add(handle);
  await waitForReady(api);
  return { api, handle };
}

function uiHost(): HTMLElement {
  const host = document.querySelector<HTMLElement>("[data-libreconsent-ui]");
  if (!host) {
    throw new Error("Expected a mounted libreconsent UI host");
  }
  return host;
}

/** The rendered tree, whether it lives in a shadow root or the light DOM. */
function surface(): ParentNode {
  const host = uiHost();
  return host.shadowRoot ?? host;
}

function query<E extends Element>(selector: string): E | null {
  return surface().querySelector<E>(selector);
}

function find<E extends Element>(selector: string): E {
  const element = query<E>(selector);
  if (!element) {
    throw new Error(`Expected "${selector}" in the rendered UI`);
  }
  return element;
}

function findAll<E extends Element>(selector: string): E[] {
  return Array.from(surface().querySelectorAll<E>(selector));
}

function bannerAction(action: string): HTMLButtonElement {
  return find<HTMLButtonElement>(
    `[data-lc-banner] [data-lc-action="${action}"]`,
  );
}

function modalAction(action: string): HTMLButtonElement {
  return find<HTMLButtonElement>(
    `[data-lc-preferences] [data-lc-action="${action}"]`,
  );
}

function categoryInput(id: string): HTMLInputElement {
  return find<HTMLInputElement>(`input[aria-labelledby$="-cat-${id}"]`);
}

function serviceInput(id: string): HTMLInputElement {
  return find<HTMLInputElement>(`input[aria-labelledby$="-svc-${id}"]`);
}

/** True while the first layer is rendered but hidden behind another surface. */
function bannerHidden(): boolean {
  return find<HTMLElement>("[data-lc-banner]").closest("[hidden]") !== null;
}

function openPreferences(): void {
  bannerAction("customize").click();
}

function preferencesDialog(): HTMLElement {
  return find<HTMLElement>("[data-lc-preferences]");
}

/** Dispatches a key on `target`; returns false when a handler consumed it. */
function press(target: HTMLElement, key: string, shiftKey: boolean): boolean {
  return target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** A page-owned control that opens preferences through the `data-cmp-open` API. */
function pageOpener(): HTMLButtonElement {
  const opener = document.createElement("button");
  opener.type = "button";
  opener.setAttribute("data-cmp-open", "");
  opener.append(document.createElement("span"));
  document.body.append(opener);
  return opener;
}

function setDocumentCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the storage under test is cookie-based
  document.cookie = value;
}

function clearAllCookies(): void {
  for (const cookie of document.cookie.split(";")) {
    const separator = cookie.indexOf("=");
    const name = (
      separator === -1 ? cookie : cookie.slice(0, separator)
    ).trim();
    if (name) {
      setDocumentCookie(
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      );
    }
  }
}

afterEach(() => {
  for (const handle of activeHandles) {
    handle.unmount();
  }
  activeHandles.clear();
  for (const api of activeApis) {
    api.reset();
  }
  activeApis.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  clearAllCookies();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("banner first layer (UI-1, UI-7)", () => {
  test("renders the title, the short text, and all three decision actions", async () => {
    await render();

    expect(find("[data-lc-banner] .lc-title").textContent).toBe(
      "We value your privacy",
    );
    expect(find("[data-lc-banner] .lc-text").textContent).toContain(
      "We use cookies",
    );
    expect(bannerAction("accept").textContent).toBe("Accept all");
    expect(bannerAction("reject").textContent).toBe("Reject all");
    expect(bannerAction("customize").textContent).toBe("Customize");
  });

  test("gives accept and reject identical markup so neither can be favored", async () => {
    await render();

    const accept = bannerAction("accept");
    const reject = bannerAction("reject");

    expect(accept.tagName).toBe("BUTTON");
    expect(reject.tagName).toBe(accept.tagName);
    expect(accept.getAttribute("class")).toBe(reject.getAttribute("class"));
    expect(accept.getAttribute("class")).toBe("lc-btn lc-btn--primary");
    expect(reject.parentElement).toBe(accept.parentElement);
  });

  test("labels and describes the dialog with elements that exist", async () => {
    await render();

    const dialog = find<HTMLElement>("[data-lc-banner]");
    const labelledBy = dialog.getAttribute("aria-labelledby") ?? "";
    const describedBy = dialog.getAttribute("aria-describedby") ?? "";

    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(labelledBy).not.toBe("");
    expect(describedBy).not.toBe("");
    expect(find(`[id="${labelledBy}"]`).textContent).toBe(
      "We value your privacy",
    );
    expect(find(`[id="${describedBy}"]`).textContent).toContain(
      "We use cookies",
    );
  });

  test.each(["bar-bottom", "box", "modal"] as const)(
    "renders the %s layout",
    async (layout) => {
      await render(baseConfig(), { layout });

      const dialog = find<HTMLElement>("[data-lc-banner]");

      expect(dialog.getAttribute("data-layout")).toBe(layout);
      expect(dialog.getAttribute("aria-modal")).toBe(
        layout === "modal" ? "true" : "false",
      );
      expect(bannerAction("accept").getAttribute("class")).toBe(
        bannerAction("reject").getAttribute("class"),
      );
    },
  );

  test.each([
    { action: "accept", method: "acceptAll", analytics: true },
    { action: "reject", method: "rejectAll", analytics: false },
  ] as const)(
    "routes the first-layer $action button to api.$method",
    async ({ action, method, analytics }) => {
      const { api } = await render();
      const spy = vi.spyOn(api, method);

      bannerAction(action).click();

      expect(spy).toHaveBeenCalledOnce();
      expect(api.getConsent()?.categories.analytics).toBe(analytics);
      expect(query("[data-lc-banner]")).toBeNull();
    },
  );

  test("routes the first-layer customize button to the preferences layer", async () => {
    await render();

    bannerAction("customize").click();

    expect(query("[data-lc-preferences]")).not.toBeNull();
    expect(bannerHidden()).toBe(true);
  });

  test("applies a pinned theme to the rendered root (UI-4)", async () => {
    await render(baseConfig(), { theme: "dark" });

    expect(find(".lc-root").getAttribute("data-lc-theme")).toBe("dark");
  });

  test("leaves the theme unpinned by default (UI-4)", async () => {
    await render();

    expect(find(".lc-root").hasAttribute("data-lc-theme")).toBe(false);
  });
});

describe("preferences second layer (UI-2, UI-7, CORE-6)", () => {
  test("renders a readonly category as an always-on badge with no checkbox", async () => {
    await render();
    openPreferences();

    const section = find<HTMLElement>('[data-lc-category="necessary"]');

    expect(section.querySelector(".lc-badge")?.textContent).toBe("Always on");
    expect(section.querySelector("input")).toBeNull();
  });

  test("leaves every optional control unchecked before a decision", async () => {
    await render();
    openPreferences();

    const inputs = findAll<HTMLInputElement>(
      "[data-lc-preferences] input.lc-check",
    );

    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      expect(input.checked).toBe(false);
      expect(input.indeterminate).toBe(false);
    }
  });

  test("renders one labelled toggle per service in a category", async () => {
    await render();
    openPreferences();

    const services = findAll<HTMLElement>(
      '[data-lc-category="analytics"] .lc-service',
    );

    expect(services).toHaveLength(2);
    expect(
      services.map((item) => item.querySelector("span")?.textContent),
    ).toEqual(["Google Analytics", "Amplitude"]);
    expect(serviceInput("ga").type).toBe("checkbox");
    expect(serviceInput("amp").type).toBe("checkbox");
    expect(serviceInput("ads").type).toBe("checkbox");
  });

  test("toggling a category checkbox sets every service it controls", async () => {
    await render();
    openPreferences();

    categoryInput("analytics").click();

    expect(serviceInput("ga").checked).toBe(true);
    expect(serviceInput("amp").checked).toBe(true);
    expect(categoryInput("analytics").indeterminate).toBe(false);
    expect(serviceInput("ads").checked).toBe(false);

    categoryInput("analytics").click();

    expect(serviceInput("ga").checked).toBe(false);
    expect(serviceInput("amp").checked).toBe(false);
  });

  test("drives the category checkbox from the services beneath it", async () => {
    await render();
    openPreferences();
    const category = categoryInput("analytics");

    serviceInput("ga").click();
    expect(category.checked).toBe(true);
    expect(category.indeterminate).toBe(true);

    serviceInput("amp").click();
    expect(category.checked).toBe(true);
    expect(category.indeterminate).toBe(false);

    serviceInput("ga").click();
    serviceInput("amp").click();
    expect(category.checked).toBe(false);
    expect(category.indeterminate).toBe(false);
  });

  test("renders one cookie row per configured cookie with translated prose", async () => {
    await render();
    openPreferences();

    const table = find<HTMLTableElement>(
      '[data-lc-category="analytics"] .lc-table',
    );
    const headers = Array.from(table.querySelectorAll("thead th"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    expect(headers.map((header) => header.textContent)).toEqual([
      "Name",
      "Purpose",
      "Provider",
      "Duration",
      "Type",
    ]);
    expect(headers.map((header) => header.getAttribute("scope"))).toEqual([
      "col",
      "col",
      "col",
      "col",
      "col",
    ]);
    expect(rows).toHaveLength(2);
    expect(
      Array.from(rows[0]?.querySelectorAll("td") ?? []).map(
        (cell) => cell.textContent,
      ),
    ).toEqual([
      "_ga",
      "Measure site usage",
      "Google",
      "Two years",
      "HTTP cookie",
    ]);
    expect(
      Array.from(rows[1]?.querySelectorAll("td") ?? []).map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["_gid", "Distinguish visitors", "—", "—", "—"]);
  });

  test("toggles the cookie disclosure panel and its aria-expanded state", async () => {
    await render();
    openPreferences();

    const toggle = find<HTMLButtonElement>(
      '[data-lc-category="analytics"] .lc-disclose',
    );
    const panel = find<HTMLElement>(
      `[id="${toggle.getAttribute("aria-controls") ?? ""}"]`,
    );

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("Show cookies");
    expect(panel.hidden).toBe(true);

    toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("Hide cookies");
    expect(panel.hidden).toBe(false);

    toggle.click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("Show cookies");
    expect(panel.hidden).toBe(true);
  });

  test("saves the rendered controls as exactly one setConsent call", async () => {
    const { api } = await render();
    const setConsent = vi.spyOn(api, "setConsent");
    openPreferences();

    serviceInput("ga").click();
    categoryInput("functional").click();
    modalAction("save").click();

    expect(setConsent).toHaveBeenCalledOnce();
    expect(setConsent).toHaveBeenCalledWith({
      categories: { functional: true },
      services: { ga: true, amp: false, ads: false },
    });
    expect(api.getConsent()).toMatchObject({
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
        functional: true,
      },
      services: { ga: true, amp: false, ads: false },
    });
    expect(query("[data-lc-preferences]")).toBeNull();
  });

  test.each([
    { action: "accept", method: "acceptAll", analytics: true },
    { action: "reject", method: "rejectAll", analytics: false },
  ] as const)(
    "routes the second-layer $action button to api.$method",
    async ({ action, method, analytics }) => {
      const { api } = await render();
      const spy = vi.spyOn(api, method);
      openPreferences();

      modalAction(action).click();

      expect(spy).toHaveBeenCalledOnce();
      expect(api.getConsent()?.categories.analytics).toBe(analytics);
      expect(query("[data-lc-preferences]")).toBeNull();
    },
  );

  test("dismisses the second layer from the close button and restores the first", async () => {
    await render();
    openPreferences();

    modalAction("close").click();

    expect(query("[data-lc-preferences]")).toBeNull();
    expect(bannerHidden()).toBe(false);
  });

  test("pre-checks only the services carried by a revision prefill (UI-7)", async () => {
    storeState(
      storedState({
        revision: 1,
        categories: {
          necessary: true,
          analytics: true,
          marketing: false,
          functional: true,
        },
        services: { ga: true, amp: false, ads: false },
      }),
    );
    const { api } = await render(baseConfig({ revision: 2 }));
    expect(api.getConsent()).toBeNull();

    openPreferences();

    expect(serviceInput("ga").checked).toBe(true);
    expect(serviceInput("amp").checked).toBe(false);
    expect(serviceInput("ads").checked).toBe(false);
    expect(categoryInput("analytics").checked).toBe(true);
    expect(categoryInput("analytics").indeterminate).toBe(true);
    expect(categoryInput("marketing").checked).toBe(false);
    expect(categoryInput("functional").checked).toBe(true);
  });
});

describe("region applicability (UI-2)", () => {
  test("renders a service whose onlyRegions include the resolved region", async () => {
    const { api } = await render(regionConfig());
    openPreferences();

    expect(
      api.getConfig().categories[1]?.services.map((service) => service.id),
    ).toEqual(["ga", "frOnly", "deOnly"]);
    const services = findAll('[data-lc-category="analytics"] .lc-service');

    expect(services).toHaveLength(2);
    expect(query('input[aria-labelledby$="-svc-ga"]')).not.toBeNull();
    expect(query('input[aria-labelledby$="-svc-frOnly"]')).not.toBeNull();
  });

  test("omits a service excluded by the resolved region", async () => {
    await render(regionConfig());
    openPreferences();

    expect(query('input[aria-labelledby$="-svc-deOnly"]')).toBeNull();
  });

  test("omits a category whose services are all excluded by the resolved region", async () => {
    await render(regionConfig());
    openPreferences();

    expect(query('[data-lc-category="regional"]')).toBeNull();
    expect(query('input[aria-labelledby$="-svc-usOnly"]')).toBeNull();
    expect(query('[data-lc-category="analytics"]')).not.toBeNull();
  });
});

describe("focus management (UI-3)", () => {
  test("moves focus into the dialog when the preferences layer opens", async () => {
    const { api } = await render();
    api.acceptAll();
    pageOpener().click();

    const dialog = preferencesDialog();
    const targets = focusable(dialog);

    expect(targets.length).toBeGreaterThan(1);
    expect(activeElement()).toBe(targets[0]);
    expect(dialog.contains(activeElement())).toBe(true);
  });

  test("wraps Tab from the last focusable control back to the first", async () => {
    const { api } = await render();
    api.acceptAll();
    pageOpener().click();

    const targets = focusable(preferencesDialog());
    const first = targets[0];
    const last = targets[targets.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    last?.focus();
    expect(activeElement()).toBe(last);

    if (last) {
      press(last, "Tab", false);
    }

    expect(activeElement()).toBe(first);
  });

  test("wraps Shift+Tab from the first focusable control back to the last", async () => {
    const { api } = await render();
    api.acceptAll();
    pageOpener().click();

    const targets = focusable(preferencesDialog());
    const first = targets[0];
    const last = targets[targets.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    first?.focus();

    if (first) {
      press(first, "Tab", true);
    }

    expect(activeElement()).toBe(last);
  });

  test("closes on Escape and restores focus to the element that opened it", async () => {
    const { api } = await render();
    api.acceptAll();
    const opener = pageOpener();
    opener.focus();
    opener.click();
    expect(query("[data-lc-preferences]")).not.toBeNull();

    press(preferencesDialog(), "Escape", false);

    expect(query("[data-lc-preferences]")).toBeNull();
    expect(activeElement()).toBe(opener);
  });

  test("reveals the first layer again when preferences close before a decision", async () => {
    await render();
    openPreferences();
    expect(bannerHidden()).toBe(true);

    press(preferencesDialog(), "Escape", false);

    expect(query("[data-lc-preferences]")).toBeNull();
    expect(bannerHidden()).toBe(false);
  });

  test("rebuilds the first layer when preferences close after the host hid it", async () => {
    const { api, handle } = await render();
    handle.hide();
    expect(query("[data-lc-banner]")).toBeNull();

    api.showPreferences();
    press(preferencesDialog(), "Escape", false);

    expect(query("[data-lc-preferences]")).toBeNull();
    expect(query("[data-lc-banner]")).not.toBeNull();
    expect(bannerHidden()).toBe(false);
  });

  // A detached node still runs any listener that was never removed, so
  // dispatching Escape on the closed first layer reports whether its trap was
  // actually released or merely dropped on the floor.
  test("releases the first layer's focus trap when the banner closes", async () => {
    const { api } = await render(baseConfig(), { layout: "modal" });
    const banner = find<HTMLElement>("[data-lc-banner]");

    api.acceptAll();

    expect(query("[data-lc-banner]")).toBeNull();
    expect(press(banner, "Escape", false)).toBe(true);
  });

  test("releases the first layer's focus trap when preferences opened over it", async () => {
    const { api } = await render(baseConfig(), { layout: "modal" });
    const banner = find<HTMLElement>("[data-lc-banner]");
    openPreferences();

    api.acceptAll();

    expect(query("[data-lc-banner]")).toBeNull();
    expect(press(banner, "Escape", false)).toBe(true);
  });
});

describe("persistent re-entry (UI-5)", () => {
  test("shows the floating settings button only once a decision exists", async () => {
    const { api } = await render();
    expect(query(".lc-fab")).toBeNull();

    api.acceptAll();

    // A contract, not an incidental assertion: the consent state travels in
    // `aria-label`, so it must never reach the DOM as text. Rendering it as a
    // visually hidden span would break this and double-announce for screen
    // reader users.
    expect(find(".lc-fab").textContent).toBe("Cookie settings");
    expect(find(".lc-fab .lc-fab-label").textContent).toBe("Cookie settings");
  });

  test("names the button with its visible label as the prefix", async () => {
    const { api } = await render();

    api.acceptAll();

    // WCAG 2.5.3: the accessible name has to start with the visible label so
    // that "click Cookie settings" works for voice control.
    expect(find(".lc-fab").getAttribute("aria-label")).toBe(
      "Cookie settings. Optional cookies allowed",
    );
  });

  test("reports an optional grant as extended", async () => {
    const { api } = await render();

    api.acceptAll();

    expect(find(".lc-fab").getAttribute("data-lc-consent")).toBe("extended");
  });

  test("reports an all-denied decision as essential", async () => {
    const { api } = await render();

    api.rejectAll();

    const fab = find(".lc-fab");
    expect(fab.getAttribute("data-lc-consent")).toBe("essential");
    expect(fab.getAttribute("aria-label")).toBe(
      "Cookie settings. Necessary cookies only",
    );
  });

  test("retracks the consent state after a later change", async () => {
    const { api } = await render();
    api.rejectAll();
    expect(find(".lc-fab").getAttribute("data-lc-consent")).toBe("essential");

    api.setConsent({ categories: { analytics: true } });

    const fab = find(".lc-fab");
    expect(fab.getAttribute("data-lc-consent")).toBe("extended");
    expect(fab.getAttribute("aria-label")).toBe(
      "Cookie settings. Optional cookies allowed",
    );
  });

  test("treats a granted service inside a denied category as extended", async () => {
    const { api } = await render();
    api.rejectAll();

    api.setConsent({ services: { ga: true } });

    expect(find(".lc-fab").getAttribute("data-lc-consent")).toBe("extended");
  });

  test("creates the button once across repeated decisions", async () => {
    const { api } = await render();

    api.acceptAll();
    api.rejectAll();

    expect(findAll(".lc-fab")).toHaveLength(1);
    // The click listener is bound only on creation, so a button that survived
    // the second decision must still open preferences.
    find<HTMLButtonElement>(".lc-fab").click();
    expect(query("[data-lc-preferences]")).not.toBeNull();
  });

  test("renders the button at the configured position", async () => {
    const { api } = await render(baseConfig(), {
      floatingButtonPosition: "bottom-end",
    });

    api.acceptAll();

    expect(find(".lc-fab").getAttribute("data-lc-position")).toBe("bottom-end");
  });

  test("defaults the button to the inline-start corner", async () => {
    const { api } = await render();

    api.acceptAll();

    expect(find(".lc-fab").getAttribute("data-lc-position")).toBe(
      "bottom-start",
    );
  });

  test("suppresses the floating settings button when it is turned off", async () => {
    const { api } = await render(baseConfig(), { floatingButton: false });

    api.acceptAll();

    expect(query(".lc-fab")).toBeNull();
  });

  test("opens the preferences layer from the floating settings button", async () => {
    const { api } = await render();
    api.acceptAll();

    find<HTMLButtonElement>(".lc-fab").click();

    expect(query("[data-lc-preferences]")).not.toBeNull();
  });

  test("opens the preferences layer from a page element marked data-cmp-open", async () => {
    await render();
    const opener = pageOpener();

    opener.querySelector("span")?.click();

    expect(query("[data-lc-preferences]")).not.toBeNull();
  });

  test("opens the preferences layer through the core showPreferences intent", async () => {
    const { api } = await render();

    api.showPreferences();

    expect(query("[data-lc-preferences]")).not.toBeNull();
  });

  test("hides every surface through the core hide intent", async () => {
    const { api } = await render();
    expect(query("[data-lc-banner]")).not.toBeNull();

    api.hide();

    expect(query("[data-lc-banner]")).toBeNull();
    expect(query("[data-lc-preferences]")).toBeNull();
  });
});

describe("mount lifecycle (UI-6)", () => {
  test("renders inside a shadow root by default", async () => {
    await render();

    const host = uiHost();

    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot?.querySelector("[data-lc-banner]")).not.toBeNull();
    expect(document.querySelector("[data-lc-banner]")).toBeNull();
  });

  test("renders into the light DOM when the shadow root is turned off", async () => {
    await render(baseConfig(), { shadow: false });

    expect(uiHost().shadowRoot).toBeNull();
    expect(document.querySelector("[data-lc-banner]")).not.toBeNull();
    expect(find("[data-lc-banner] .lc-title").textContent).toBe(
      "We value your privacy",
    );
  });

  test("mounts into a configured container element", async () => {
    const container = document.createElement("section");
    document.body.append(container);

    await render(baseConfig(), { container });

    expect(container.querySelector("[data-libreconsent-ui]")).not.toBeNull();
    expect(uiHost().parentElement).toBe(container);
  });

  test("throws when the same consent API is mounted twice", async () => {
    const { api } = await render();

    expect(() => mount(api)).toThrow(
      "mount: this consent API already has a mounted UI",
    );
  });

  test("removes every rendered element and stops reacting to the core on unmount", async () => {
    const { api, handle } = await render();
    const opener = pageOpener();

    handle.unmount();

    expect(document.querySelector("[data-libreconsent-ui]")).toBeNull();
    api.acceptAll();
    api.showPreferences();
    opener.click();
    expect(document.querySelector("[data-libreconsent-ui]")).toBeNull();
    expect(document.querySelector("[data-lc-preferences]")).toBeNull();
    expect(document.querySelector(".lc-fab")).toBeNull();
  });

  test("shows the first layer when initialization finds no decision", async () => {
    const { api } = await render();

    expect(api.getConsent()).toBeNull();
    expect(query("[data-lc-banner]")).not.toBeNull();
    expect(bannerHidden()).toBe(false);
    expect(query(".lc-fab")).toBeNull();
  });

  test("keeps the first layer hidden when a stored decision is restored", async () => {
    storeState(storedState());

    const { api } = await render();

    expect(api.getConsent()?.services.ga).toBe(true);
    expect(query("[data-lc-banner]")).toBeNull();
    expect(query(".lc-fab")).not.toBeNull();
  });

  test("sets the host lang attribute from the resolved locale (UI-8)", async () => {
    await render(baseConfig(), { locale: "fr" });

    expect(uiHost().getAttribute("lang")).toBe("fr");
    expect(find("[data-lc-banner] .lc-title").textContent).toBe(
      "Votre vie privée nous importe",
    );
    expect(bannerAction("accept").textContent).toBe("Tout accepter");
  });
});

describe("pre-decision storage silence (CORE-8)", () => {
  test("writes nothing while the banner and preferences are on screen", async () => {
    const { api } = await render();

    expect(query("[data-lc-banner]")).not.toBeNull();
    openPreferences();
    serviceInput("ga").click();
    categoryInput("functional").click();

    expect(api.getConsent()).toBeNull();
    expect(document.cookie).toBe("");
    expect(window.localStorage.length).toBe(0);

    // Proves the assertions above are not vacuous: the same surfaces do write
    // through to storage the moment the visitor actually decides.
    modalAction("save").click();

    expect(api.getConsent()).not.toBeNull();
    expect(document.cookie).toContain("libreconsent=");
    expect(window.localStorage.getItem("libreconsent")).not.toBeNull();
  });
});

describe("US opt-out dialog (US-1, US-2, US-3)", () => {
  function usConfig(overrides: Partial<CmpConfig> = {}): CmpConfig {
    return baseConfig({
      resolveRegion: async () => "US",
      usPrivacy: { enabled: true, doNotSellSelector: "#do-not-sell" },
      ...overrides,
    });
  }

  /** A page-owned "Do Not Sell" link with a nested child to click through. */
  function doNotSellLink(): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = "#";
    link.id = "do-not-sell";
    link.append(document.createElement("span"));
    document.body.append(link);
    return link;
  }

  function optOutDialog(): HTMLElement {
    return find<HTMLElement>("[data-lc-optout]");
  }

  function optOutAction(action: string): HTMLButtonElement {
    return find<HTMLButtonElement>(
      `[data-lc-optout] [data-lc-action="${action}"]`,
    );
  }

  function stored(): string | null {
    return window.localStorage.getItem("libreconsent");
  }

  test("shows no banner and offers re-entry for an undecided US visitor (US-3)", async () => {
    await render(usConfig());

    expect(query("[data-lc-banner]")).toBeNull();
    expect(query(".lc-fab")).not.toBeNull();
    expect(stored()).toBeNull();
  });

  test("reports the implied US grant on the re-entry button (US-3, UI-5)", async () => {
    await render(usConfig());

    // Under the opt-out model the visitor is consenting until they say
    // otherwise, so "allowed" is the honest reading of the implied state.
    expect(find(".lc-fab").getAttribute("data-lc-consent")).toBe("extended");
  });

  test("opens from a click inside the configured link (US-2)", async () => {
    const link = doNotSellLink();
    await render(usConfig());

    link.querySelector("span")?.click();

    const dialog = optOutDialog();
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(find("[data-lc-optout] .lc-title").textContent).toBe(
      "Do Not Sell or Share My Personal Information",
    );
    expect(stored()).toBeNull();
  });

  test("records the opt-out as an explicit decision that keeps other consent", async () => {
    const link = doNotSellLink();
    const { api } = await render(usConfig());
    link.click();

    optOutAction("opt-out").click();

    expect(api.getConsent()).toMatchObject({
      categories: { analytics: true, marketing: false, functional: true },
    });
    expect(api.getConsent()?.implied).toBeUndefined();
    expect(stored()).not.toBeNull();
    expect(query("[data-lc-optout]")).toBeNull();
  });

  test("reports an opt-out already in force instead of offering it again", async () => {
    const link = doNotSellLink();
    const { handle } = await render(usConfig());
    link.click();
    optOutAction("opt-out").click();

    handle.showOptOut();

    expect(find("[data-lc-optout] .lc-text").textContent).toContain(
      "You have opted out",
    );
    expect(query('[data-lc-optout] [data-lc-action="opt-out"]')).toBeNull();
  });

  test("treats fixed-denied ad signals as already opted out without fabricating categories", async () => {
    const link = doNotSellLink();
    const { api } = await render(
      usConfig({
        consentMode: {
          mapping: {
            ad_storage: { mode: "fixed", value: "denied" },
            ad_user_data: { mode: "fixed", value: "denied" },
            ad_personalization: { mode: "fixed", value: "denied" },
          },
        },
      }),
    );

    link.click();

    expect(find("[data-lc-optout] .lc-text").textContent).toContain(
      "You have opted out",
    );
    expect(query('[data-lc-optout] [data-lc-action="opt-out"]')).toBeNull();
    expect(Object.keys(api.getConsent()?.categories ?? {})).not.toContain(
      "[object Object]",
    );
    expect(stored()).toBeNull();
  });

  test("closes on Escape, restores focus, and stores nothing (UI-3, CORE-8)", async () => {
    const link = doNotSellLink();
    await render(usConfig());
    link.focus();
    link.click();
    const dialog = optOutDialog();

    expect(press(dialog, "Escape", false)).toBe(false);

    expect(query("[data-lc-optout]")).toBeNull();
    expect(activeElement()).toBe(link);
    expect(stored()).toBeNull();
  });

  test("traps Tab inside the dialog (UI-3)", async () => {
    const link = doNotSellLink();
    await render(usConfig());
    link.click();
    const dialog = optOutDialog();
    const targets = focusable(dialog);

    targets[targets.length - 1]?.focus();
    expect(press(dialog, "Tab", false)).toBe(false);

    expect(activeElement()).toBe(targets[0]);
  });

  test("hides an open banner and restores it when dismissed undecided", async () => {
    const link = doNotSellLink();
    await render(
      baseConfig({
        usPrivacy: { enabled: true, doNotSellSelector: "#do-not-sell" },
      }),
    );
    expect(query("[data-lc-banner]")).not.toBeNull();

    link.click();
    expect(bannerHidden()).toBe(true);

    optOutAction("dismiss").click();

    expect(bannerHidden()).toBe(false);
    expect(stored()).toBeNull();
  });

  test("survives a malformed selector without breaking other clicks", async () => {
    const opener = pageOpener();
    // A listener exception does not propagate out of `click()`, so the damage a
    // malformed selector does is an uncaught error on every click in the page.
    const onError = vi.fn();
    window.addEventListener("error", onError);
    try {
      // `init()` rejects an unparseable selector (CFG-6), so the only way one
      // reaches the controller is a config that never went through it. Mounting
      // against a host-supplied `getConfig()` is that path, and the guard has to
      // hold on it.
      const api = start(usConfig());
      const config = api.getConfig();
      vi.spyOn(api, "getConfig").mockReturnValue({
        ...config,
        usPrivacy: { ...config.usPrivacy, doNotSellSelector: ":::not-valid" },
      });
      const handle = mount(api);
      activeHandles.add(handle);
      await waitForReady(api);

      document.body.click();

      expect(onError).not.toHaveBeenCalled();
      expect(query("[data-lc-optout]")).toBeNull();

      opener.click();

      expect(query("[data-lc-preferences]")).not.toBeNull();
    } finally {
      window.removeEventListener("error", onError);
    }
  });

  test("binds nothing when no selector is configured", async () => {
    const link = doNotSellLink();
    await render(usConfig({ usPrivacy: { enabled: true } }));

    link.click();

    expect(query("[data-lc-optout]")).toBeNull();
  });

  test("binds nothing while the module is disabled", async () => {
    const link = doNotSellLink();
    // The selector is part of `usPrivacy`, so a disabled module must not be
    // able to record a decision through its dialog.
    await render(
      baseConfig({
        usPrivacy: { enabled: false, doNotSellSelector: "#do-not-sell" },
      }),
    );

    link.click();

    expect(query("[data-lc-optout]")).toBeNull();
    expect(query("[data-lc-banner]")).not.toBeNull();
    expect(stored()).toBeNull();
  });

  test("keeps the programmatic opt-out inert while the module is disabled", async () => {
    // `api.showOptOut()` and the mount handle bypass the selector, so gating
    // only the delegated click would leave the dialog reachable — and able to
    // record a decision — for a configuration that switched the module off.
    const { api, handle } = await render(
      baseConfig({ usPrivacy: { enabled: false } }),
    );

    api.showOptOut();
    handle.showOptOut();

    expect(query("[data-lc-optout]")).toBeNull();
    expect(query("[data-lc-banner]")).not.toBeNull();
    expect(stored()).toBeNull();
  });

  test("leaves the banner hidden when dismissed over an open preferences layer", async () => {
    const link = doNotSellLink();
    const { api } = await render(
      baseConfig({
        usPrivacy: { enabled: true, doNotSellSelector: "#do-not-sell" },
      }),
    );
    api.showPreferences();
    expect(bannerHidden()).toBe(true);

    link.click();
    optOutAction("dismiss").click();

    // Preferences is still open, so revealing the first layer would leave it
    // visible behind a modal dialog.
    expect(query("[data-lc-preferences]")).not.toBeNull();
    expect(bannerHidden()).toBe(true);
  });

  test("leaves the banner hidden when preferences close over an open dialog", async () => {
    const link = doNotSellLink();
    const { api } = await render(
      baseConfig({
        usPrivacy: { enabled: true, doNotSellSelector: "#do-not-sell" },
      }),
    );

    // The mirror of the case above: the two layers stack in this order too,
    // because `api.showPreferences()` is reachable while the dialog is open.
    link.click();
    api.showPreferences();
    modalAction("close").click();

    expect(query("[data-lc-optout]")).not.toBeNull();
    expect(bannerHidden()).toBe(true);

    // Closing the last layer still gets the visitor back to a way to consent.
    optOutAction("dismiss").click();

    expect(bannerHidden()).toBe(false);
    expect(stored()).toBeNull();
  });

  test("opens through the core renderer intent and the mount handle (US-2)", async () => {
    const { api, handle } = await render(usConfig());

    api.showOptOut();
    expect(query("[data-lc-optout]")).not.toBeNull();

    handle.hide();
    expect(query("[data-lc-optout]")).toBeNull();

    handle.showOptOut();
    expect(query("[data-lc-optout]")).not.toBeNull();
  });

  test("translates the dialog through the locale dictionaries", async () => {
    const { handle } = await render(usConfig(), { locale: "fr" });

    handle.showOptOut();

    expect(find("[data-lc-optout] .lc-title").textContent).toBe(
      "Ne pas vendre ni partager mes informations personnelles",
    );
    expect(optOutAction("opt-out").textContent).toBe(
      "Refuser la vente ou le partage",
    );
  });

  test("releases the dialog's focus trap on unmount", async () => {
    const link = doNotSellLink();
    const { handle } = await render(usConfig());
    link.click();
    const dialog = optOutDialog();

    handle.unmount();
    activeHandles.clear();

    expect(press(dialog, "Escape", false)).toBe(true);
  });
});

describe("markup safety (G-6)", () => {
  test("renders a markup-shaped translation as literal text", async () => {
    await render(
      baseConfig({
        i18n: {
          default: "en",
          translations: {
            en: { ...dictionary, "category.marketing.label": HOSTILE_LABEL },
          },
        },
      }),
    );
    openPreferences();

    const title = find<HTMLElement>(
      '[data-lc-category="marketing"] .lc-group-title',
    );

    expect(title.textContent).toBe(HOSTILE_LABEL);
    expect(title.children).toHaveLength(0);
    expect(query("img")).toBeNull();
  });

  test("renders no script element in either layer", async () => {
    await render();

    expect(query("script")).toBeNull();

    openPreferences();

    expect(query("script")).toBeNull();
    expect(findAll("*").some((node) => node.tagName === "SCRIPT")).toBe(false);
  });
});
