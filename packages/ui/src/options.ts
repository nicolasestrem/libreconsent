// SPDX-License-Identifier: MIT
/**
 * First-layer presentation. `bar-bottom` is a non-blocking bottom bar, `box`
 * a floating card, and `modal` a centered dialog with an overlay.
 */
export type BannerLayout = "bar-bottom" | "box" | "modal";

/**
 * Colour scheme. `auto` follows `prefers-color-scheme`; the other two pin it
 * regardless of the visitor's system setting (UI-4 manual override).
 */
export type Theme = "auto" | "light" | "dark";

/**
 * Renderer options passed to `mount()`.
 *
 * These are deliberately separate from `CmpConfig`: presentation choices never
 * affect the consent record, so they must not participate in the core's
 * configuration identity or its size budget.
 */
export interface UiOptions {
  /** First-layer presentation. Defaults to `bar-bottom`. */
  layout?: BannerLayout;
  /** Colour scheme. Defaults to `auto` (follows `prefers-color-scheme`). */
  theme?: Theme;
  /** Whether to render inside a shadow root. Defaults to `true` (UI-6). */
  shadow?: boolean;
  /** Host element for the renderer. Defaults to `document.body`. */
  container?: Element;
  /** Whether to show the persistent settings button. Defaults to `true`. */
  floatingButton?: boolean;
  /** Locale override. Must be one of the configured locales. */
  locale?: string;
}

/** Fully defaulted renderer options. */
export interface NormalizedUiOptions {
  layout: BannerLayout;
  theme: Theme;
  shadow: boolean;
  container: Element | null;
  floatingButton: boolean;
  locale: string | null;
}

const LAYOUTS: readonly BannerLayout[] = ["bar-bottom", "box", "modal"];
const THEMES: readonly Theme[] = ["auto", "light", "dark"];

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

/**
 * Validates and defaults renderer options, throwing synchronously with the
 * offending path so setup mistakes surface at mount time.
 */
export function normalizeOptions(options: UiOptions = {}): NormalizedUiOptions {
  if (options === null || typeof options !== "object") {
    fail("options", "must be an object");
  }

  const { layout = "bar-bottom", theme = "auto" } = options;
  if (!LAYOUTS.includes(layout)) {
    fail("options.layout", `must be one of ${LAYOUTS.join(", ")}`);
  }
  if (!THEMES.includes(theme)) {
    fail("options.theme", `must be one of ${THEMES.join(", ")}`);
  }

  if (options.shadow !== undefined && typeof options.shadow !== "boolean") {
    fail("options.shadow", "must be a boolean");
  }
  if (
    options.floatingButton !== undefined &&
    typeof options.floatingButton !== "boolean"
  ) {
    fail("options.floatingButton", "must be a boolean");
  }
  if (
    options.container !== undefined &&
    !(options.container instanceof Element)
  ) {
    fail("options.container", "must be an Element");
  }
  if (options.locale !== undefined && typeof options.locale !== "string") {
    fail("options.locale", "must be a string");
  }

  return {
    layout,
    theme,
    shadow: options.shadow ?? true,
    container: options.container ?? null,
    floatingButton: options.floatingButton ?? true,
    locale: options.locale ?? null,
  };
}
