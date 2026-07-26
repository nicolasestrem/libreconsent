import { afterEach, describe, expect, test, vi } from "vitest";
import { BlockingController } from "./blocking";
import { normalizeConfig } from "./config";
import {
  type BlockingConfig,
  type CmpConfig,
  type ConsentApi,
  ConsentError,
  type ConsentState,
  en,
  fr,
  init,
  type NormalizedCmpConfig,
  type ReadyEvent,
} from "./index";

/**
 * jsdom evaluates the re-created inline scripts, but in the vm global backing
 * the document rather than the test's global, so their side effects are not
 * observable from here. These tests therefore assert the DOM shape the
 * controller produces — replacement identity, position, and attributes — while
 * the Playwright suite (spec §11.3) proves the scripts really run in order.
 * Every inline body below is a plain assignment so evaluation cannot throw.
 */

const dictionary = {
  "category.analytics.label": "Analytics",
  "category.analytics.description": "Analytics description",
  "category.marketing.label": "Marketing",
  "category.marketing.description": "Marketing description",
  "service.ga.label": "Google Analytics",
  "service.amp.label": "Amplitude",
  "service.ads.label": "Advertising",
};

function baseConfig(overrides: Partial<CmpConfig> = {}): CmpConfig {
  return {
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
        services: [
          { id: "ga", label: "service.ga.label" },
          { id: "amp", label: "service.amp.label" },
        ],
      },
      {
        id: "marketing",
        label: "category.marketing.label",
        description: "category.marketing.description",
        services: [{ id: "ads", label: "service.ads.label" }],
      },
    ],
    i18n: {
      default: "en",
      translations: { en: dictionary },
    },
    ...overrides,
  };
}

const activeApis = new Set<ConsentApi>();
const activeControllers = new Set<BlockingController>();

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

function expectConsentError(
  operation: () => unknown,
  code: "INVALID_CONFIG" | "INVALID_SELECTION",
  path: string,
): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConsentError);
    expect(error).toMatchObject({ code, path });
    expect((error as Error).message).toContain(path);
    return;
  }
  throw new Error(`Expected ${code} at ${path}`);
}

function setDocumentCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the storage contract under test is cookie-based
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

/**
 * Advances the controller's internal unblock chain.
 *
 * Each step costs two microtask ticks: one for the `.then` that starts the
 * round, one for every `await` resumption. jsdom never fetches a `src` script,
 * so the chain parks on the replacement's `load` listener and no number of
 * microtasks can flush past it — flushing generously stays precise.
 */
async function flushChain(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Expected #${id} in the document`);
  }
  return element;
}

function script(id: string): HTMLScriptElement {
  const element = byId(id);
  if (!(element instanceof HTMLScriptElement)) {
    throw new Error(`Expected #${id} to be a script`);
  }
  return element;
}

/** A gate is still closed while it carries the neutralizing `text/plain` type. */
function stillGated(id: string): boolean {
  return byId(id).getAttribute("type") === "text/plain";
}

function placeholderBefore(id: string): HTMLElement {
  const placeholder = byId(id).previousElementSibling;
  if (!(placeholder instanceof HTMLElement)) {
    throw new Error(`Expected a placeholder before #${id}`);
  }
  expect(placeholder.hasAttribute("data-libreconsent-placeholder")).toBe(true);
  return placeholder;
}

function noticeText(placeholder: HTMLElement): string | null {
  return placeholder.querySelector("p")?.textContent ?? null;
}

function acceptButton(placeholder: HTMLElement): HTMLButtonElement {
  const button = placeholder.querySelector("button");
  if (button === null) {
    throw new Error("Expected an accept button in the placeholder");
  }
  return button;
}

function decision(categories: Record<string, boolean>): ConsentState {
  const timestamp = "2026-07-26T10:00:00.000Z";
  return {
    consentId: "9d235664-2d3d-4db5-8117-36c0ac57e920",
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    categories,
    services: {},
  };
}

/**
 * Minimal `ConsentApi` stand-in for the two cases `init()` cannot express:
 * injecting the reload function, and controlling DOM readiness without a second
 * controller scanning the same document.
 */
function harness(overrides: Partial<CmpConfig> = {}): {
  api: ConsentApi;
  config: NormalizedCmpConfig;
  emit: (state: ConsentState) => void;
} {
  const config = normalizeConfig(baseConfig(overrides));
  const listeners = new Set<(state: ConsentState) => void>();
  let current: ConsentState | null = null;
  const api: ConsentApi = {
    getConsent: () => current,
    acceptAll: () => undefined,
    rejectAll: () => undefined,
    setConsent: () => undefined,
    withdraw: () => undefined,
    showPreferences: () => undefined,
    hide: () => undefined,
    on: (event, callback) => {
      const listener = callback as unknown as (state: ConsentState) => void;
      if (event === "consent" || event === "change") {
        listeners.add(listener);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    off: () => undefined,
    getConfig: () => config,
    reset: () => undefined,
  };
  return {
    api,
    config,
    emit: (state) => {
      current = state;
      for (const listener of [...listeners]) {
        listener(state);
      }
    },
  };
}

function controllerFor(
  built: { api: ConsentApi; config: NormalizedCmpConfig },
  reload: () => void,
): BlockingController {
  const controller = new BlockingController(built.api, built.config, reload);
  activeControllers.add(controller);
  return controller;
}

afterEach(() => {
  for (const api of activeApis) {
    api.reset();
  }
  activeApis.clear();
  for (const controller of activeControllers) {
    controller.dispose();
  }
  activeControllers.clear();
  // Drops the own property the readiness test shadows the prototype getter
  // with. A no-op for every other test.
  Reflect.deleteProperty(document, "readyState");
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  clearAllCookies();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("blocking configuration (BLK-1, BLK-2, BLK-5)", () => {
  test.each([
    { name: "an empty nonce", blocking: { nonce: "" }, path: "blocking.nonce" },
    {
      name: "a non-boolean reloadOnWithdraw",
      blocking: { reloadOnWithdraw: "yes" },
      path: "blocking.reloadOnWithdraw",
    },
    { name: "an array", blocking: [], path: "blocking" },
    { name: "a string", blocking: "on", path: "blocking" },
  ])("throws a typed synchronous error for $name", ({ blocking, path }) => {
    expectConsentError(
      () =>
        start(baseConfig({ blocking: blocking as unknown as BlockingConfig })),
      "INVALID_CONFIG",
      path,
    );
  });

  test("normalizes blocking defaults and freezes them", async () => {
    const api = start(baseConfig());
    await waitForReady(api);

    const { blocking } = api.getConfig();
    expect(blocking).toEqual({ reloadOnWithdraw: false });
    expect("nonce" in blocking).toBe(false);
    expect(Object.isFrozen(blocking)).toBe(true);
    expect(() => {
      (blocking as { reloadOnWithdraw: boolean }).reloadOnWithdraw = true;
    }).toThrow(TypeError);
  });

  test("keeps blocking part of singleton compatibility", async () => {
    const first = start(baseConfig({ blocking: { nonce: "shared-nonce" } }));
    await waitForReady(first);

    expect(start(baseConfig({ blocking: { nonce: "shared-nonce" } }))).toBe(
      first,
    );
    expectConsentError(
      () => start(baseConfig({ blocking: { nonce: "other-nonce" } })),
      "INVALID_CONFIG",
      "config",
    );
  });
});

describe("gated script execution (BLK-1)", () => {
  test("leaves gated scripts inert and writes nothing before a decision", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="inline">window.inlineRan = true;</script>
      <script type="text/plain" data-cmp-category="marketing" id="remote" src="/tracker.js"></script>
    `;
    const cookieSetter = vi.spyOn(document, "cookie", "set");
    const mirrorSetter = vi.spyOn(window.localStorage, "setItem");
    const api = start(baseConfig());

    await waitForReady(api);
    await flushChain();

    expect(stillGated("inline")).toBe(true);
    expect(stillGated("remote")).toBe(true);
    expect(byId("inline").textContent).toBe("window.inlineRan = true;");
    expect(byId("remote").parentElement).toBe(document.body);
    expect(api.getConsent()).toBeNull();
    expect(cookieSetter).not.toHaveBeenCalled();
    expect(mirrorSetter).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("libreconsent=");
    expect(window.localStorage.getItem("libreconsent")).toBeNull();
  });

  test("re-creates gated scripts for a granted category only", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="granted">window.grantedRan = true;</script>
      <script type="text/plain" data-cmp-category="unconfigured" id="denied">window.deniedRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(stillGated("granted")).toBe(false);
    expect(script("granted").getAttribute("type")).toBeNull();
    expect(script("granted").textContent).toBe("window.grantedRan = true;");
    expect(script("granted").parentElement).toBe(document.body);
    expect(stillGated("denied")).toBe(true);
  });

  test("holds document order across an inline, src, inline sequence", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="first">window.firstRan = true;</script>
      <script type="text/plain" data-cmp-category="analytics" id="remote" src="/remote.js"></script>
      <script type="text/plain" data-cmp-category="analytics" id="second">window.secondRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(stillGated("first")).toBe(false);
    expect(stillGated("remote")).toBe(false);
    // The chain is parked on the src replacement's load event, so the trailing
    // inline gate must not have been touched yet.
    expect(stillGated("second")).toBe(true);

    script("remote").dispatchEvent(new Event("load"));
    await flushChain();

    expect(stillGated("second")).toBe(false);
    expect(
      Array.from(document.body.querySelectorAll("script"), (element) =>
        element.getAttribute("id"),
      ),
    ).toEqual(["first", "remote", "second"]);
  });

  test("advances the remaining order when a gated src script fails", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="broken" src="/missing.js"></script>
      <script type="text/plain" data-cmp-category="analytics" id="after">window.afterRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();
    expect(stillGated("broken")).toBe(false);
    expect(stillGated("after")).toBe(true);

    script("broken").dispatchEvent(new Event("error"));
    await flushChain();

    expect(stillGated("after")).toBe(false);
  });

  test("inserts an async gated script without awaiting it", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="async-remote" src="/async.js" async></script>
      <script type="text/plain" data-cmp-category="analytics" id="trailing">window.trailingRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    const asyncScript = script("async-remote");
    expect(asyncScript.getAttribute("type")).toBeNull();
    expect(asyncScript.hasAttribute("async")).toBe(true);
    // jsdom does not implement the `async` IDL property, so an own property
    // exists only where the controller assigned one. Running out of order is
    // what `async` asks for, so the script-inserted force-async flag must be
    // left alone here.
    expect(
      Object.getOwnPropertyDescriptor(asyncScript, "async"),
    ).toBeUndefined();
    // Nothing awaited the async script, so the trailing gate already opened.
    expect(stillGated("trailing")).toBe(false);
  });

  test("clears force-async and preserves defer for an ordered gated script", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="ordered" src="/ordered.js" defer></script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    const ordered = script("ordered");
    expect(ordered.hasAttribute("async")).toBe(false);
    // Reads back the force-async clear that keeps a src/inline mix in document
    // order; jsdom has no `async` IDL property of its own to interfere.
    expect(ordered.async).toBe(false);
    expect(ordered.defer).toBe(true);
    expect(ordered.getAttribute("src")).toBe("/ordered.js");
  });

  test("copies every non-CMP attribute and strips the CMP ones", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" data-cmp-service="ga"
              id="widget" data-widget="chat" data-locale="en-GB"
              src="/widget.js" defer crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    const widget = script("widget");
    expect(widget.getAttribute("id")).toBe("widget");
    expect(widget.getAttribute("data-widget")).toBe("chat");
    expect(widget.getAttribute("data-locale")).toBe("en-GB");
    expect(widget.getAttribute("src")).toBe("/widget.js");
    expect(widget.getAttribute("crossorigin")).toBe("anonymous");
    expect(widget.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(widget.defer).toBe(true);
    expect(widget.getAttribute("type")).toBeNull();
    expect(
      Array.from(widget.attributes, (attribute) => attribute.name).filter(
        (name) => name.startsWith("data-cmp-"),
      ),
    ).toEqual([]);
  });

  test("promotes data-cmp-type to the replacement type", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-type="module" data-cmp-category="analytics" id="esm">window.esmRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(script("esm").getAttribute("type")).toBe("module");
    expect(script("esm").type).toBe("module");
  });

  test("keeps unblocking later grants after a failed round", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="doomed">window.doomedRan = true;</script>
      <script type="text/plain" data-cmp-category="marketing" id="later">window.laterRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementationOnce(() => {
        throw new Error("re-creation failed");
      });
    api.setConsent({ services: { ga: true } });
    await flushChain();
    createElement.mockRestore();

    expect(stillGated("doomed")).toBe(true);

    // A rejected chain would silently swallow every later grant on the page.
    api.setConsent({ services: { ads: true } });
    await flushChain();

    expect(stillGated("later")).toBe(false);
    expect(script("later").textContent).toBe("window.laterRan = true;");
  });

  test("skips a gate detached before consent without stalling the rest", async () => {
    // A detached src gate is the case that can hang the chain: replacing a
    // parentless node is a silent no-op, so a replacement that never enters the
    // document would never fire the load event the chain awaits.
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="detached" src="/detached.js"></script>
      <script type="text/plain" data-cmp-category="analytics" id="kept">window.keptRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);
    const detached = byId("detached");
    detached.remove();

    expect(() => api.acceptAll()).not.toThrow();
    await flushChain();

    expect(detached.parentNode).toBeNull();
    expect(detached.getAttribute("type")).toBe("text/plain");
    expect(stillGated("kept")).toBe(false);
  });
});

describe("CSP nonce propagation (BLK-2)", () => {
  test("applies the configured nonce to a script that has none", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="plain">window.plainRan = true;</script>
    `;
    const api = start(baseConfig({ blocking: { nonce: "config-nonce" } }));
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(script("plain").nonce).toBe("config-nonce");
    expect(script("plain").getAttribute("nonce")).toBe("config-nonce");
  });

  test("prefers the element's own nonce over the configured one", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="owned" nonce="element-nonce">window.ownedRan = true;</script>
    `;
    const api = start(baseConfig({ blocking: { nonce: "config-nonce" } }));
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(script("owned").nonce).toBe("element-nonce");
    expect(script("owned").getAttribute("nonce")).toBe("element-nonce");
  });

  test("adds no nonce when neither the element nor the config supplies one", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="bare">window.bareRan = true;</script>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();

    expect(script("bare").hasAttribute("nonce")).toBe(false);
    expect(script("bare").nonce).toBe("");
  });
});

describe("embed placeholders (BLK-3)", () => {
  test("blocks an iframe and renders a localized placeholder before it", async () => {
    document.body.innerHTML = `
      <iframe id="video" data-cmp-src="https://www.youtube-nocookie.com/embed/x" data-cmp-category="analytics" title="Video"></iframe>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    const iframe = byId("video");
    expect(iframe.hasAttribute("src")).toBe(false);
    expect(iframe.hidden).toBe(true);
    expect(iframe.style.display).toBe("none");

    const placeholder = placeholderBefore("video");
    expect(noticeText(placeholder)).toBe(en["blocked.notice"]);
    const button = acceptButton(placeholder);
    expect(button.type).toBe("button");
    expect(button.textContent).toBe(en["blocked.accept"]);
  });

  test("reveals the iframe and restores the author's display on accept", async () => {
    document.body.innerHTML = `
      <iframe id="video" data-cmp-src="https://www.youtube-nocookie.com/embed/x" data-cmp-category="analytics" style="display: block"></iframe>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    acceptButton(placeholderBefore("video")).click();

    const iframe = byId("video");
    expect(api.getConsent()?.categories.analytics).toBe(true);
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/x",
    );
    expect(iframe.hidden).toBe(false);
    expect(iframe.style.display).toBe("block");
    expect(
      document.querySelector("[data-libreconsent-placeholder]"),
    ).toBeNull();
  });

  test("gates and reveals a generic data-cmp-placeholder element", async () => {
    document.body.innerHTML = `
      <div id="map" data-cmp-placeholder data-cmp-category="marketing">Map widget</div>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    const map = byId("map");
    expect(map.hidden).toBe(true);
    expect(map.style.display).toBe("none");
    expect(noticeText(placeholderBefore("map"))).toBe(en["blocked.notice"]);

    acceptButton(placeholderBefore("map")).click();

    expect(api.getConsent()?.categories.marketing).toBe(true);
    expect(map.hidden).toBe(false);
    expect(map.style.display).toBe("");
    expect(
      document.querySelector("[data-libreconsent-placeholder]"),
    ).toBeNull();
  });

  test("opens a service-scoped gate on the service, not its category", async () => {
    document.body.innerHTML = `
      <iframe id="embed" data-cmp-src="https://example.test/embed" data-cmp-category="analytics" data-cmp-service="ga"></iframe>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    // The category reads granted from `amp` alone, but the gate names `ga`.
    api.setConsent({ services: { amp: true } });
    expect(api.getConsent()?.categories.analytics).toBe(true);
    expect(byId("embed").hasAttribute("src")).toBe(false);

    const setConsent = vi.spyOn(api, "setConsent");
    acceptButton(placeholderBefore("embed")).click();

    expect(setConsent).toHaveBeenCalledWith({ services: { ga: true } });
    expect(api.getConsent()?.services.ga).toBe(true);
    expect(byId("embed").getAttribute("src")).toBe(
      "https://example.test/embed",
    );
  });

  test("renders placeholder prose in the configured locale", async () => {
    document.body.innerHTML = `
      <iframe id="video" data-cmp-src="https://example.test/embed" data-cmp-category="analytics"></iframe>
    `;
    const api = start(
      baseConfig({ i18n: { default: "fr", translations: { fr: dictionary } } }),
    );
    await waitForReady(api);

    const placeholder = placeholderBefore("video");
    expect(noticeText(placeholder)).toBe(fr["blocked.notice"]);
    expect(acceptButton(placeholder).textContent).toBe(fr["blocked.accept"]);
    expect(noticeText(placeholder)).not.toBe(en["blocked.notice"]);
  });

  test("fails closed for a gate naming an unknown category", async () => {
    document.body.innerHTML = `
      <iframe id="orphan" data-cmp-src="https://example.test/embed" data-cmp-category="not-configured"></iframe>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();

    expect(byId("orphan").hasAttribute("src")).toBe(false);
    expect(byId("orphan").hidden).toBe(true);

    const button = acceptButton(placeholderBefore("orphan"));
    expect(() => button.click()).not.toThrow();
    expect(byId("orphan").hasAttribute("src")).toBe(false);
    expect(byId("orphan").hidden).toBe(true);
    expect(noticeText(placeholderBefore("orphan"))).toBe(en["blocked.notice"]);
  });
});

describe("withdrawal after execution (BLK-5)", () => {
  test("re-blocks embeds on withdrawal but leaves executed scripts in place", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="tag">window.tagRan = true;</script>
      <iframe id="video" data-cmp-src="https://example.test/embed" data-cmp-category="analytics"></iframe>
    `;
    const api = start(baseConfig());
    await waitForReady(api);

    api.acceptAll();
    await flushChain();
    expect(stillGated("tag")).toBe(false);
    expect(byId("video").getAttribute("src")).toBe(
      "https://example.test/embed",
    );

    api.withdraw();
    await flushChain();

    const executed = script("tag");
    expect(executed.getAttribute("type")).toBeNull();
    expect(executed.parentElement).toBe(document.body);
    expect(executed.textContent).toBe("window.tagRan = true;");

    const iframe = byId("video");
    expect(iframe.hasAttribute("src")).toBe(false);
    expect(iframe.hidden).toBe(true);
    expect(iframe.style.display).toBe("none");
    expect(noticeText(placeholderBefore("video"))).toBe(en["blocked.notice"]);
  });

  test("reloads when an executed script loses consent and the option is on", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="tag">window.tagRan = true;</script>
    `;
    const reload = vi.fn();
    const granted = harness({ blocking: { reloadOnWithdraw: true } });
    controllerFor(granted, reload);

    granted.emit(decision({ necessary: true, analytics: true }));
    await flushChain();
    expect(stillGated("tag")).toBe(false);
    expect(reload).not.toHaveBeenCalled();

    granted.emit(decision({ necessary: true, analytics: false }));

    expect(reload).toHaveBeenCalledOnce();
  });

  test("does not reload when nothing had executed", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="tag">window.tagRan = true;</script>
    `;
    const reload = vi.fn();
    const never = harness({ blocking: { reloadOnWithdraw: true } });
    controllerFor(never, reload);

    never.emit(decision({ necessary: true, analytics: false }));
    await flushChain();
    never.emit(decision({ necessary: true, analytics: false }));

    expect(stillGated("tag")).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  test("does not reload with the default reloadOnWithdraw", async () => {
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="tag">window.tagRan = true;</script>
    `;
    const reload = vi.fn();
    const disabled = harness();
    expect(disabled.config.blocking.reloadOnWithdraw).toBe(false);
    controllerFor(disabled, reload);

    disabled.emit(decision({ necessary: true, analytics: true }));
    await flushChain();
    disabled.emit(decision({ necessary: true, analytics: false }));

    expect(stillGated("tag")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("DOM readiness (BLK-1)", () => {
  test("defers the first scan until DOMContentLoaded while the document is loading", async () => {
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "loading",
    });
    document.body.innerHTML = `
      <script type="text/plain" data-cmp-category="analytics" id="tag">window.tagRan = true;</script>
      <iframe id="video" data-cmp-src="https://example.test/embed" data-cmp-category="analytics"></iframe>
    `;
    const loading = harness();
    controllerFor(loading, vi.fn());

    loading.emit(decision({ necessary: true, analytics: true }));
    await flushChain();

    expect(stillGated("tag")).toBe(true);
    expect(byId("video").hidden).toBe(false);
    expect(
      document.querySelector("[data-libreconsent-placeholder]"),
    ).toBeNull();

    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flushChain();

    expect(stillGated("tag")).toBe(false);
    expect(byId("video").getAttribute("src")).toBe(
      "https://example.test/embed",
    );
  });
});
