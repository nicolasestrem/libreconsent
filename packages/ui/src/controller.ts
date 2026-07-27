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
import type { NormalizedUiOptions } from "./options";
import { styles } from "./styles";

let instances = 0;

const EMPTY_CHOICES: Choices = { categories: {}, services: {} };

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

  private releaseTrap: (() => void) | null = null;

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
      this.renderFab();
    };
    this.teardown.push(this.api.on("consent", onDecision));
    this.teardown.push(this.api.on("change", onDecision));
    this.teardown.push(this.api.registerRenderer(this));

    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-cmp-open]")) {
        event.preventDefault();
        this.showPreferences();
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
    this.releaseTrap = trapFocus(
      preferences.dialog,
      () => this.closePreferences(true),
      restoreTo,
    );
    focusFirst(preferences.dialog);
  }

  /** Removes every visible surface without changing consent state. */
  hide(): void {
    this.closePreferences(false);
    this.closeBanner();
  }

  /** Unsubscribes, unregisters and removes all rendered DOM. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.releaseTrap?.();
    this.releaseTrap = null;
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
      this.releaseTrap = trapFocus(banner.dialog, () => {}, null);
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
    if (this.context.layout === "modal") {
      this.releaseTrap?.();
      this.releaseTrap = null;
    }
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
    if (reopenBanner && !this.decided) {
      // Revealed before focus restore so the trap has a focusable target.
      // Rebuilt when the host called `hide()` while preferences were open.
      if (this.banner) {
        this.setBannerHidden(false);
      } else {
        this.openBanner();
      }
    }
    this.releaseTrap?.();
    this.releaseTrap = null;
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
