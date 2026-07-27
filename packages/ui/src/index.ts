import type { ConsentApi } from "@libreconsent/core";
import { UiController } from "./controller";
import { normalizeOptions, type UiOptions } from "./options";

const mounted = new WeakSet<ConsentApi>();

/**
 * Handle returned by {@link mount}.
 */
export interface UiHandle {
  /** Opens the preferences layer. */
  showPreferences(): void;
  /** Opens the "Do Not Sell or Share" opt-out dialog (US-2). */
  showOptOut(): void;
  /** Hides every rendered surface without changing consent state. */
  hide(): void;
  /** Removes the UI and releases every listener it registered. */
  unmount(): void;
}

/**
 * Renders the consent banner and preferences modal for an initialized core.
 *
 * The renderer only reads state and calls the core's public decision methods,
 * so nothing reaches storage before the visitor chooses (CORE-8). It also
 * registers itself with the core, which makes `api.showPreferences()` and
 * `api.hide()` operative from that point on.
 *
 * @example
 * ```ts
 * const api = init({ categories: [...] });
 * mount(api, { layout: "bar-bottom" });
 * ```
 */
export function mount(api: ConsentApi, options?: UiOptions): UiHandle {
  if (mounted.has(api)) {
    throw new Error("mount: this consent API already has a mounted UI");
  }
  const controller = new UiController(api, normalizeOptions(options));
  mounted.add(api);
  return {
    showPreferences: () => controller.showPreferences(),
    showOptOut: () => controller.showOptOut(),
    hide: () => controller.hide(),
    unmount: () => {
      mounted.delete(api);
      controller.dispose();
    },
  };
}

export { uiEn, uiFr } from "./dictionaries";
export type { BannerLayout, Theme, UiOptions } from "./options";
