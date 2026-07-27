import type {
  ConsentApi,
  ConsentPrefill,
  ConsentState,
  NormalizedCmpConfig,
} from "@libreconsent/core";
import { type Banner, createBanner } from "./banner";
import type { RenderContext } from "./context";
import { el, whenBodyReady } from "./dom";
import { activeElement, focusFirst, trapFocus } from "./focus";
import { buildDictionary, resolveLocale, translate } from "./i18n";
import { type Choices, createPreferences, type Preferences } from "./modal";
import { createOptOut, type OptOut } from "./opt-out";
import type { NormalizedUiOptions } from "./options";
import { styles } from "./styles";

let instances = 0;

const EMPTY_CHOICES: Choices = { categories: {}, services: {} };

/**
 * Whether `target` or an ancestor matches a host-supplied selector.
 *
 * `closest()` throws on a malformed selector and this runs on every click in
 * the document, so one bad configuration value must not break the whole page.
 */
function matchesSelector(target: Element, selector: string): boolean {
  try {
    return target.closest(selector) !== null;
  } catch {
    return false;
  }
}

/**
 * Applies the stylesheet to `root`.
 *
 * A constructable stylesheet is preferred because it is exempt from
 * `style-src` CSP restrictions; the `<style>` element covers engines without
 * `adoptedStyleSheets` (Safari below 16.4).
 */
function injectStyles(root: ShadowRoot | Document): () => void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return () => {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
        (entry) => entry !== sheet,
      );
    };
  } catch {
    const element = el("style", {}, [styles]);
    (root instanceof Document ? root.head : root).append(element);
    return () => element.remove();
  }
}

/**
 * Owns the mounted DOM and keeps it in step with the core lifecycle.
 *
 * The controller never persists anything: the core remains the only writer of
 * consent state, so a rendered but undecided banner leaves storage untouched
 * (CORE-8).
 */
export class UiController {
  private readonly context: RenderContext;

  private readonly config: NormalizedCmpConfig;

  private readonly host: HTMLElement;

  private readonly root: HTMLElement;

  private readonly surface: ShadowRoot | HTMLElement;

  private readonly teardown: (() => void)[] = [];

  private region: string | null = null;

  private prefill: ConsentPrefill | null = null;

  private decided = false;

  private banner: Banner | null = null;

  private preferences: Preferences | null = null;

  private optOut: OptOut | null = null;

  // One field per surface: several layers can be trapped at the same time (a
  // modal-layout banner sits behind an open dialog), so a single field would
  // lose the first release function and leak its listener.
  private bannerTrap: (() => void) | null = null;

  private preferencesTrap: (() => void) | null = null;

  private optOutTrap: (() => void) | null = null;

  private fab: HTMLElement | null = null;

  private disposed = false;

  constructor(
    private readonly api: ConsentApi,
    private readonly options: NormalizedUiOptions,
  ) {
    this.config = api.getConfig();
    const locale = resolveLocale(this.config, options.locale);
    const dictionary = buildDictionary(this.config, locale);
    instances += 1;
    const prefix = `lc${instances}`;
    this.context = {
      t: (key) => translate(dictionary, key),
      id: (suffix) => `${prefix}-${suffix.replace(/\s+/g, "_")}`,
      layout: options.layout,
    };

    this.host = el("div", { "data-libreconsent-ui": "", lang: locale });
    this.root = el("div", {
      class: "lc-root",
      ...(options.theme === "auto" ? {} : { "data-lc-theme": options.theme }),
    });
    if (options.shadow) {
      const shadow = this.host.attachShadow({ mode: "open" });
      this.teardown.push(injectStyles(shadow));
      shadow.append(this.root);
      this.surface = shadow;
    } else {
      this.teardown.push(injectStyles(document));
      this.host.append(this.root);
      this.surface = this.root;
    }

    this.teardown.push(
      whenBodyReady(() => {
        if (!this.disposed) {
          (this.options.container ?? document.body).append(this.host);
        }
      }),
    );

    this.teardown.push(
      this.api.on("ready", (payload) => {
        this.region = payload.region;
        this.prefill = payload.prefill ?? null;
        this.decided = payload.consent !== null;
        if (this.decided) {
          this.renderFab();
        } else {
          this.openBanner();
        }
      }),
    );
    const onDecision = (state: ConsentState): void => {
      this.region = state.region ?? this.region;
      this.decided = true;
      this.closeBanner();
      this.closePreferences(false);
      this.closeOptOut(false);
      this.renderFab();
    };
    this.teardown.push(this.api.on("consent", onDecision));
    this.teardown.push(this.api.on("change", onDecision));
    this.teardown.push(this.api.registerRenderer(this));

    // Only when the module is switched on: the selector belongs to `usPrivacy`,
    // so leaving it live under `enabled: false` would let a configuration that
    // opted out of the US model still record decisions through its dialog.
    const doNotSellSelector = this.config.usPrivacy.enabled
      ? this.config.usPrivacy.doNotSellSelector
      : undefined;
    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest("[data-cmp-open]")) {
        event.preventDefault();
        this.showPreferences();
        return;
      }
      if (
        doNotSellSelector !== undefined &&
        matchesSelector(target, doNotSellSelector)
      ) {
        event.preventDefault();
        this.showOptOut();
      }
    };
    document.addEventListener("click", onDocumentClick);
    this.teardown.push(() =>
      document.removeEventListener("click", onDocumentClick),
    );
  }

  /** Opens the preferences layer, creating it on first use. */
  showPreferences(): void {
    if (this.disposed || this.preferences) {
      return;
    }
    const restoreTo = activeElement();
    const preferences = createPreferences(
      this.context,
      this.config,
      this.region,
      {
        save: (selection) => this.api.setConsent(selection),
        accept: () => this.api.acceptAll(),
        reject: () => this.api.rejectAll(),
        close: () => this.closePreferences(true),
      },
    );
    preferences.sync(this.currentChoices());
    this.preferences = preferences;
    // Hidden rather than removed: the button that opened preferences must stay
    // connected for focus restore to have somewhere to go.
    this.setBannerHidden(true);
    this.root.append(preferences.root);
    this.preferencesTrap = trapFocus(
      preferences.dialog,
      () => this.closePreferences(true),
      restoreTo,
    );
    focusFirst(preferences.dialog);
  }

  /**
   * Opens the "Do Not Sell or Share" dialog, creating it on first use (US-2).
   *
   * A separate, smaller surface than the banner: US state privacy is an opt-out
   * regime, so this asks nothing and offers one action.
   */
  showOptOut(): void {
    // The guard belongs here as well as on the delegated selector: this method
    // is also reached from `api.showOptOut()` and the mount handle, and a
    // disabled module must not record a decision through any of the three.
    if (this.disposed || this.optOut || !this.config.usPrivacy.enabled) {
      return;
    }
    const restoreTo = activeElement();
    const optOut = createOptOut(this.context, this.optedOut(), {
      confirm: () => this.api.setConsent({ categories: this.deniedAds() }),
      close: () => this.closeOptOut(true),
    });
    this.optOut = optOut;
    // Hidden rather than removed, for the same reason as the preferences layer:
    // focus restore needs its target still connected to the document.
    this.setBannerHidden(true);
    this.root.append(optOut.root);
    this.optOutTrap = trapFocus(
      optOut.dialog,
      () => this.closeOptOut(true),
      restoreTo,
    );
    focusFirst(optOut.dialog);
  }

  /** Removes every visible surface without changing consent state. */
  hide(): void {
    this.closeOptOut(false);
    this.closePreferences(false);
    this.closeBanner();
  }

  /** Unsubscribes, unregisters and removes all rendered DOM. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.optOutTrap?.();
    this.optOutTrap = null;
    this.preferencesTrap?.();
    this.preferencesTrap = null;
    this.bannerTrap?.();
    this.bannerTrap = null;
    for (const release of this.teardown.splice(0)) {
      release();
    }
    this.host.remove();
  }

  /**
   * Choices the preferences layer should start from: the active decision, or a
   * revision prefill, or nothing at all. Optional categories are never
   * pre-checked without one of those (UI-7).
   */
  private currentChoices(): Choices {
    const consent = this.api.getConsent();
    if (consent) {
      return { categories: consent.categories, services: consent.services };
    }
    return this.prefill ?? EMPTY_CHOICES;
  }

  /**
   * Non-readonly categories the three Google ad signals map to (US-1, US-2).
   *
   * Filtered against the configured categories so a mapping the core never
   * reads — possible when both Consent Mode and the US module are off — cannot
   * turn a link click into a rejected selection.
   */
  private adCategoryIds(): string[] {
    const { mapping } = this.config.consentMode;
    const mapped = new Set([
      mapping.ad_storage,
      mapping.ad_user_data,
      mapping.ad_personalization,
    ]);
    return this.config.categories
      .filter((category) => mapped.has(category.id) && !category.readonly)
      .map((category) => category.id);
  }

  private deniedAds(): Record<string, boolean> {
    return Object.fromEntries(this.adCategoryIds().map((id) => [id, false]));
  }

  /** Whether an active state already denies every ad category. */
  private optedOut(): boolean {
    const consent = this.api.getConsent();
    return (
      consent !== null &&
      this.adCategoryIds().every((id) => consent.categories[id] !== true)
    );
  }

  private openBanner(): void {
    if (this.disposed || this.banner) {
      return;
    }
    const banner = createBanner(this.context, {
      accept: () => this.api.acceptAll(),
      reject: () => this.api.rejectAll(),
      customize: () => this.showPreferences(),
    });
    this.banner = banner;
    this.root.append(banner.root);
    if (this.context.layout === "modal") {
      // Escape deliberately does nothing on the first layer: it asks for a
      // decision and has no dismiss action to trigger. Rejecting is one
      // keypress away and carries the same weight as accepting, so the visitor
      // is never cornered into consenting (UI-7). Escape does close the
      // preferences layer, which is the dialog UI-3's requirement is about.
      this.bannerTrap = trapFocus(banner.dialog, () => {}, null);
    }
    banner.dialog.focus({ preventScroll: true });
  }

  private setBannerHidden(hidden: boolean): void {
    if (this.banner) {
      this.banner.root.hidden = hidden;
    }
  }

  private closeBanner(): void {
    if (!this.banner) {
      return;
    }
    this.bannerTrap?.();
    this.bannerTrap = null;
    this.banner.root.remove();
    this.banner = null;
  }

  /**
   * Closes the preferences layer. `reopenBanner` restores the first layer when
   * the visitor backs out without deciding, so dismissing preferences can never
   * strand them without a way to consent.
   */
  private closePreferences(reopenBanner: boolean): void {
    if (!this.preferences) {
      return;
    }
    this.preferences.root.remove();
    this.preferences = null;
    // Not while the opt-out dialog is still open, mirroring `closeOptOut`: the
    // two layers stack in either order through `api.showPreferences()`, and
    // whichever closes first must not reveal the first layer behind the one
    // left open (D-031). Whichever closes last still reveals it, so an
    // undecided visitor is never stranded without a way to consent.
    if (reopenBanner && !this.decided && !this.optOut) {
      // Revealed before focus restore so the trap has a focusable target.
      // Rebuilt when the host called `hide()` while preferences were open.
      if (this.banner) {
        this.setBannerHidden(false);
      } else {
        this.openBanner();
      }
    }
    this.preferencesTrap?.();
    this.preferencesTrap = null;
  }

  /**
   * Closes the opt-out dialog. `reopenBanner` restores a first layer that was
   * hidden to show it, so an undecided EEA visitor who follows a Do Not Sell
   * link is never stranded without a way to consent.
   */
  private closeOptOut(reopenBanner: boolean): void {
    if (!this.optOut) {
      return;
    }
    this.optOut.root.remove();
    this.optOut = null;
    // Not while preferences are still open: that layer hid the banner for its
    // own focus-restore reasons (D-031), and revealing it here would leave the
    // first layer visible behind an open dialog.
    if (reopenBanner && !this.decided && !this.preferences) {
      if (this.banner) {
        this.setBannerHidden(false);
      } else {
        this.openBanner();
      }
    }
    this.optOutTrap?.();
    this.optOutTrap = null;
  }

  private renderFab(): void {
    if (this.disposed || !this.options.floatingButton || this.fab) {
      return;
    }
    const button = el(
      "button",
      { type: "button", class: "lc-fab", "data-lc-action": "settings" },
      [this.context.t("ui.settings")],
    );
    button.addEventListener("click", () => this.showPreferences());
    this.fab = button;
    this.root.append(button);
  }

  /** Exposed for tests that need to reach into the rendered tree. */
  get container(): ShadowRoot | HTMLElement {
    return this.surface;
  }
}
