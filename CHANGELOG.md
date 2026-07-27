# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Phase 4 UI: `@libreconsent/ui` ships `mount(api, options?)`, rendering the
  consent banner (`bar-bottom`, `box` or `modal`) and the preferences modal in
  an open shadow root, with a light-DOM fallback. Accept all and reject all are
  emitted as the same button style in the same group, so equal prominence
  cannot be undone by a theme or layout.
- Preferences second layer: per-category sections, per-service toggles with
  mixed-state category checkboxes, and collapsible cookie tables. Readonly
  categories are stated as "always on" and expose no control; services excluded
  by `onlyRegions` are not rendered at all, because the core cannot grant them.
- WCAG 2.1 AA behaviour: labelled dialogs, focus trap, Escape to close, focus
  restore to the invoking control, visible focus, and `prefers-reduced-motion`
  support. axe-core runs against both layers in light and dark themes in CI,
  alongside keyboard-only accept and reject journeys and an equal-prominence
  check.
- Theming through `--libreconsent-*` custom properties only, with automatic
  `prefers-color-scheme` support and a `theme: "light" | "dark"` override. No
  external asset, font or network request.
- English and French renderer dictionaries (`uiEn`, `uiFr`) covering the banner,
  preferences and cookie-table strings, all overridable per locale through the
  core's `i18n.translations`. Browser-language selection for `i18n.autoDetect`
  is now implemented, and the resolved locale is written to the mount point's
  `lang` attribute.
- Persistent re-entry: a config-removable floating settings button, a
  `data-cmp-open` attribute binding, and `api.showPreferences()`.
- `registerRenderer()` on `ConsentApi`, which makes the core's `showPreferences()`
  and `hide()` intents operative once a renderer is mounted.
- `region` on the `ready` event payload, so a renderer can tell which services
  are grantable before any decision exists.
- `specs/A11Y_CHECKLIST.md` for the manual accessibility passes required by UI-3.
- An examples-server route for the built UI bundle, and a `basic-site` fixture
  that mounts the real UI with services and cookie disclosures.
- Phase 3 declarative blocking in `@libreconsent/core`: `type="text/plain"`
  script gates re-created in document order with `async`/`defer` semantics and
  attributes preserved, `data-cmp-service` and `data-cmp-type` support, and
  CSP nonce propagation from either the element or `blocking.nonce`.
- Iframe (`data-cmp-src`) and generic (`data-cmp-placeholder`) embed gates that
  render an i18n placeholder with an inline accept control, plus the
  `blocked.notice` / `blocked.accept` keys in the English and French
  dictionaries and YouTube and Google Maps embed recipes.
- `blocking.reloadOnWithdraw` (default `false`) for the case where an already
  executed script's consent is revoked, since scripts cannot be un-executed.
- The flagship `pre-consent-network-silence` E2E: real vendored `gtag.js` on
  `examples/basic-site` proving zero pre-consent contact with the endpoints
  fixed by spec §11.2, granted collects after accept, and continued silence
  after reject — guarded by a test that request interception observes
  `navigator.sendBeacon`, so the negative assertions cannot become vacuous.
- `examples/blocking-site` and `examples/csp-site` fixtures and an examples
  server route that serves the built core browser bundle.
- A phase-aware traceability gate that checks completed requirement coverage,
  duplicate or malformed rows, passing status, and referenced repository files
  from both `pnpm check` and GitHub Actions.
- TOOL-1..5 traceability evidence and structural valid/broken fixtures for the
  checker.
- Phase 1 `@libreconsent/core` configuration validation and normalization,
  consent state lifecycle, replayable events, queued decisions, region
  resolution, and cookie/localStorage persistence.
- Public core configuration, consent, event, selection, cookie-disclosure, and
  typed error contracts, with English and French reference dictionaries.
- Core lifecycle, storage, region, revision-prefill, and invariant unit
  coverage plus Phase 1 API and Cloudflare region-resolver documentation.
- Cross-platform Vitest startup that disables Node's built-in experimental Web
  Storage with the canonical Node 24/26 flag, plus repository-wide LF
  normalization for deterministic Biome checks.
- Event hardening for throwing replay callbacks, FIFO delivery of reentrant
  decisions, and post-withdrawal decisions that remain on the `change` channel.
- Monotonic decision timestamps that remain valid when the wall clock moves
  backward.
- Phase 0 pnpm monorepo scaffold with typed package stubs, CI gates, examples, and test tooling.

### Changed

- Updated the root project status from the obsolete Phase 0 stub description
  to the completed Phase 1 core scope and next Phase 2 milestone.
- Recorded CM-4's explicit Phase 2 documentation and Phase 3 basic-mode BLK
  delivery boundary in D-019.
- Google Consent Mode v2 head defaults, lifecycle-driven four-signal updates,
  regional defaults, and compiled-fixture ordering coverage.
- `examples/basic-site` now passes a real `Date` to `gtag("js", …)`. The former
  placeholder string kept real `gtag.js` from firing any tag at all, which would
  have made the flagship network-silence assertions vacuous.

### Fixed

- A gated script queued under a grant no longer executes if consent is withdrawn
  while the queue is parked on a slower gate. Each gate's consent is re-read
  immediately before it runs, and a skipped gate stays eligible for a later
  grant.
- `blocking.reloadOnWithdraw: true` no longer reloads the page for a gate that
  never ran — one still queued behind a slower gate, detached before its turn, or
  that failed to be re-created. A reload is reserved for effects that exist.
- An inline `data-cmp-type="module"` gate is now awaited, so a following classic
  gate can no longer run ahead of it. Module evaluation is deferred even inline.
- A generic `data-cmp-placeholder` gate keeps its own `src`. It was previously
  stripped on block but restored only for iframes, permanently breaking a gated
  `img` or `video` once consent arrived.
- An omitted `enabled` value in the standalone Consent Mode head configuration
  now remains side-effect-free, matching the public configuration default.
- Traceability verification evidence must reference a configured
  unit/E2E/accessibility test or a supported named CI gate.
