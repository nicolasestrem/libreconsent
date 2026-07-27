# @libreconsent/ui

Consent banner and preferences modal for [`@libreconsent/core`](../core).

Renders in a shadow root by default so host CSS cannot alter it, ships zero
runtime dependencies, and loads no external asset or font. It only reads core
state and calls the core's public decision methods — nothing is written to
storage before the visitor decides.

## Quickstart

```ts
import { init } from "@libreconsent/core";
import { mount } from "@libreconsent/ui";

const api = init({
  categories: [
    {
      id: "analytics",
      label: "category.analytics.label",
      description: "category.analytics.description",
      services: [{ id: "ga4", label: "service.ga4.label" }],
    },
  ],
  i18n: {
    translations: {
      en: {
        "category.analytics.label": "Analytics",
        "category.analytics.description": "Measures how visitors use this site.",
        "service.ga4.label": "Google Analytics 4",
      },
    },
  },
});

mount(api);
```

From a browser bundle, both packages expose IIFE globals:

```html
<script src="/libreconsent-core.global.js"></script>
<script src="/libreconsent-ui.global.js"></script>
<script>
  const api = LibreConsentCore.init({ /* … */ });
  LibreConsentUi.mount(api);
</script>
```

## `mount(api, options?)`

Returns a handle with `showPreferences()`, `hide()` and `unmount()`. Mounting
twice against the same core instance throws.

Mounting also registers the renderer with the core, so `api.showPreferences()`
and `api.hide()` become operative from that point on.

| Option | Default | Meaning |
| --- | --- | --- |
| `layout` | `"bar-bottom"` | First layer presentation: `bar-bottom`, `box` or `modal`. |
| `theme` | `"auto"` | `auto` follows `prefers-color-scheme`; `light` / `dark` pin it. |
| `shadow` | `true` | Render inside a shadow root. `false` renders into the light DOM. |
| `container` | `document.body` | Element the UI is appended to. |
| `floatingButton` | `true` | Show the persistent settings button after a decision. |
| `locale` | — | Force a locale. Must be one of the configured locales, or `mount()` throws. |

Invalid options throw synchronously with the offending path, e.g.
`options.layout: must be one of bar-bottom, box, modal`.

## Reopening preferences

Three entry points, all equivalent:

- the persistent settings button (disable with `floatingButton: false`);
- any element carrying `data-cmp-open`, e.g.
  `<button type="button" data-cmp-open>Cookie preferences</button>`;
- `api.showPreferences()` or the handle's `showPreferences()`.

## Theming

Every value resolves through a `--libreconsent-*` custom property, so themes are
set with CSS rather than by overriding selectors. Define them anywhere that the
mount point inherits from, typically `:root`:

```css
:root {
  --libreconsent-accent: #6d28d9;
  --libreconsent-accent-fg: #ffffff;
  --libreconsent-radius: 12px;
  --libreconsent-font-family: "Inter", system-ui, sans-serif;
}
```

Available tokens: `bg`, `fg`, `muted`, `surface`, `border`, `accent`,
`accent-fg`, `overlay`, `focus`, `radius`, `space`, `z-index`, `font-family`,
`font-size`, `max-width`, `shadow` — each prefixed with `--libreconsent-`.

Dark mode follows `prefers-color-scheme` automatically. Pass
`theme: "light"` or `theme: "dark"` to `mount()` to pin it instead, or define
the tokens yourself to bypass both.

Accept all and Reject all deliberately share one button style. Themes change
both together; there is no token that demotes only the reject action (UI-7).

## Internationalisation

Strings come from the core's `i18n.translations`, falling back to this package's
English and French reference dictionaries (`uiEn`, `uiFr`). Any key can be
overridden per locale in the core config.

With `i18n.autoDetect: true`, the mounted locale is chosen from
`navigator.languages`, preferring an exact tag match over a base-language match,
then falling back to `i18n.default`. The resolved locale is written to the
`lang` attribute of the mount point.

Keys this package adds beyond the core's `ui.acceptAll` / `ui.rejectAll` /
`ui.customize` / `ui.save`: `ui.title`, `ui.description`,
`ui.preferences.title`, `ui.preferences.description`, `ui.close`,
`ui.settings`, `ui.alwaysOn`, `ui.cookies.show`, `ui.cookies.hide`,
`ui.cookies.name`, `ui.cookies.purpose`, `ui.cookies.provider`,
`ui.cookies.duration`, `ui.cookies.type`.

## Accessibility

WCAG 2.1 AA is a release gate: axe-core runs in CI against both layers in light
and dark themes, and `specs/A11Y_CHECKLIST.md` covers the manual passes. Both
layers are dialogs with labelled controls; preferences traps focus, closes on
Escape and restores focus to whatever opened it. Transitions are suppressed
under `prefers-reduced-motion`.

Layout uses logical properties throughout, so a right-to-left document mirrors
structurally without a second stylesheet.

## What it never does

- Pre-check an optional category or service (except restoring a saved decision,
  or a sanitized prefill after a revision bump).
- Re-prompt a visitor who has already decided, unless the decision expired or
  the configured revision increased.
- Write to storage. Only the core persists, and only after a decision.
- Fetch anything. No fonts, no icons, no telemetry.

## Build and test

```sh
pnpm --filter @libreconsent/ui build
pnpm --filter @libreconsent/ui test
```
