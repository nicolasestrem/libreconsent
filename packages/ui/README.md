# @libreconsent/ui

Consent banner and preferences modal for
[`@libreconsent/core`](https://github.com/nicolasestrem/libreconsent/tree/v1.1.0/packages/core#readme).

Renders in a shadow root by default so host CSS cannot alter it, ships zero
runtime dependencies, and loads no external asset or font. It only reads core
state and calls the core's public decision methods — nothing is written to
storage before the visitor decides.

```sh
pnpm add @libreconsent/core @libreconsent/ui
```

Part of the [libreconsent](https://github.com/nicolasestrem/libreconsent)
monorepo.

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
| `floatingButtonPosition` | `"bottom-start"` | Corner the settings button occupies: `bottom-start` or `bottom-end`. |
| `locale` | — | Force a locale. Must be one of the configured locales, or `mount()` throws. |

Invalid options throw synchronously with the offending path, e.g.
`options.layout: must be one of bar-bottom, box, modal`.

## Reopening preferences

Three entry points, all equivalent:

- the persistent settings button (disable with `floatingButton: false`);
- any element carrying `data-cmp-open`, e.g.
  `<button type="button" data-cmp-open>Cookie preferences</button>`;
- `api.showPreferences()` or the handle's `showPreferences()`.

### The persistent settings button

A 40 × 40 disc that appears once a decision exists, resting at reduced opacity so
it recedes into the page. Hovering it or reaching it with the keyboard reveals its
label; a touch device leaves it a plain disc, since there is no hover to reveal
anything, but the label is still revealed on focus for anyone using a keyboard
with one.

`floatingButtonPosition` moves it between the bottom corners. The values are
logical, so `bottom-end` is the bottom right of a left-to-right document and the
bottom left of a right-to-left one. The bottom offset clears the iOS home
indicator via `env(safe-area-inset-bottom)`, and `--libreconsent-fab-inset`
adjusts it if the corner is already occupied by a control of your own:

```css
:root { --libreconsent-fab-inset: 5rem; }
```

The disc carries a small indicator of what is currently active: filled when
anything beyond the necessary categories is allowed, a hollow ring when only the
necessary ones are. The two states differ by shape rather than by colour, and
neither is green or red, because an indicator that codes one outcome as good is a
nudge (UI-7). The state is also part of the button's accessible name, which reads
"Cookie settings. Optional cookies allowed" or "Cookie settings. Necessary cookies
only" — the visible label stays the prefix, so voice control still responds to
"click Cookie settings". Both halves come from the i18n layer
(`ui.settings.extended`, `ui.settings.essential`).

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
`font-size`, `max-width`, `shadow`, `fab-inset` — each prefixed with
`--libreconsent-`.

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
`ui.settings`, `ui.settings.extended`, `ui.settings.essential`,
`ui.alwaysOn`, `ui.cookies.show`, `ui.cookies.hide`,
`ui.cookies.name`, `ui.cookies.purpose`, `ui.cookies.provider`,
`ui.cookies.duration`, `ui.cookies.type`, `ui.optOut.title`,
`ui.optOut.description`, `ui.optOut.confirm`, `ui.optOut.done`.

## Do Not Sell or Share dialog

When the core is configured with `usPrivacy.doNotSellSelector`, clicks on a
matching element open a third, deliberately minimal surface: one sentence and
one action, not the consent banner. US state privacy is an opt-out regime, so
the dialog asks nothing — it records a decision to deny the categories the
Google ad signals map to and leaves everything else as it was. When the opt-out
is already in force it says so instead of offering the action again.

Clicks are delegated from the document, so links rendered after mount work
without re-mounting. A malformed selector is contained: it can never throw out
of the page's click handling. `handle.showOptOut()` and the core's
`api.showOptOut()` open the same dialog programmatically.

Where the opt-out model applies, no banner is shown at all — the visitor is
consenting until they say otherwise — so the persistent settings button and the
Do Not Sell link are the entry points.

## Accessibility

WCAG 2.1 AA is a release gate: axe-core runs in CI against all three surfaces in
light and dark themes, and the
[accessibility checklist](https://github.com/nicolasestrem/libreconsent/blob/v1.1.0/specs/A11Y_CHECKLIST.md)
covers the manual passes. Each is a dialog with labelled controls; preferences
and the opt-out dialog trap focus, close on Escape and restore focus to
whatever opened it. Transitions are suppressed under `prefers-reduced-motion`.

Layout uses logical properties throughout, so a right-to-left document mirrors
structurally without a second stylesheet.

## Layout stability

Neither layer is part of the document flow. The banner, the preferences overlay
and the persistent settings button are all `position: fixed`, so they are painted
over the page instead of displacing it: mounting the UI contributes **zero** to
Cumulative Layout Shift no matter when consent code finishes loading, and no
space needs to be reserved for it.

The settings button holds to this even as it reveals its label. The label is
positioned out of flow rather than growing the disc, so nothing moves: were the
disc to expand in place it would displace its own start position wherever its
pinned edge is the far one — `bottom-end` in a left-to-right document, and
`bottom-start` in a right-to-left one — and hover does not count as recent input,
so those shifts would reach real Core Web Vitals unexcluded.

`tests/hardening.e2e.spec.ts` enforces this with a buffered `layout-shift`
PerformanceObserver installed before any page script, asserting no shift entry
through banner paint, preferences open, and the settings button appearing and
revealing its label at either corner — alongside a companion test that displaces
real content to prove the observer would catch a regression.

The one exception is your own CSS: if you override the container to
`position: static` or `relative`, or place the mount point inside a flow
container you have styled, layout stability becomes your responsibility.

## What it never does

- Pre-check an optional category or service (except restoring a saved decision,
  or a sanitized prefill after a revision bump).
- Re-prompt a visitor who has already decided, unless the decision expired or
  the configured revision increased.
- Write to storage. Only the core persists, and only after a decision.
- Fetch anything. No fonts, no icons, no telemetry.

## Guarantees and boundaries

- MIT-licensed, with no third-party runtime dependencies, external assets,
  telemetry, or network requests.
- Core `^1.0.0` is a required peer dependency, so package managers enforce the
  compatible pair.
- ESM and TypeScript consumers import only from the two package roots. Deep
  imports are unsupported and blocked by the export map. Self-hosted browsers
  copy `dist/index.global.js` and use the `LibreConsentUi` global after
  `LibreConsentCore`.
- Browser support targets the last two evergreen Chrome/Edge/Firefox releases
  and Safari 15.4+. Only Chromium is automated until real adoption warrants
  cross-browser coverage.
- Default EN/FR strings are engineering starting points, not legal advice.

## Build and test

```sh
pnpm --filter @libreconsent/ui build
pnpm --filter @libreconsent/ui test
```

The repository release audit installs the packed UI and core tarballs into a
temporary TypeScript/ESM consumer, verifies `LibreConsentUi.mount`, and proves
unsupported deep imports stay closed.
