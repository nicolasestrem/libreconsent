# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Phase 8 optional decision receipts: `receiptEndpoint` posts a persisted
  explicit decision with `keepalive`, while restored, revision-prefill,
  implied-US, and GPC-derived states remain silent. Delivery is off by default,
  never retried, and fully isolated from state, persistence, events, and UI.
- `@libreconsent/worker-log`: a dependency-free ES-module Cloudflare Worker,
  tracked D1 migration, exact-origin CORS/host checks, strict 16 KiB JSON
  validation, privacy-preserving `Origin + consentId` rate limiting, bearer-only
  ordered retrieval, and daily server-time retention purge.
- Cloudflare runtime integration tests backed by isolated Miniflare/D1 storage,
  plus a manual dedicated-account round-trip and scheduled-purge command that
  has no public test-only endpoint.
- Phase 7 read-only bridge: `initBridge(config)` discovers a same-window
  external TCF v2 CMP with bounded exponential-backoff polling, subscribes
  through `addEventListener`, and exposes `getConsent()`, replayable `ready` /
  `consent`, non-replayable `change`, `on()` / `off()`, and teardown-only
  `reset()`. It does not provide `__tcfapi`, expose TC strings, render UI, write
  storage, emit Google signals, or access the network.
- A frozen `DEFAULT_PURPOSE_MAPPING`: analytics requires TCF purposes 1, 7, 8,
  9 and 10; marketing requires 1, 2, 3 and 4. Both use strict `all`
  aggregation. Custom mappings are complete replacements and may explicitly
  choose `all` or `any`; `necessary` remains always true and cannot be
  remapped.
- Truthful bridge state containing only `source`, mapped `categories`,
  `services`, `gdprApplies`, and `observedAt`. Direct TCF observations report
  no service choices, and the bridge never invents a consent ID, revision,
  persisted-decision marker, or decision timestamp.
- Optional dependency-free fallback handoff: after the discovery timeout a
  host-supplied factory may initialize full libreconsent and have its
  `ready` / `consent` / `change` events forwarded as `source: "fallback"`.
  Delaying core/UI creation until that handoff ensures only one banner owner.
  A throwing factory fails closed to `source: "none"` without an unhandled
  asynchronous error.
- Confirmed external CMP listeners remain active after the discovery deadline,
  so a later user decision continues through the TCF bridge and cannot
  incorrectly activate the fallback UI.
- Phase 6 US state privacy: the `usPrivacy` configuration block
  (`{ enabled, regions, doNotSellSelector, respectGPC }`) makes one
  configuration serve both regulatory models. Where it applies, an undecided
  visitor gets the US opt-out model — no banner, optional categories behaving as
  granted so gated tags run and Consent Mode reads granted — while visitors
  outside those regions keep the EEA opt-in banner. Which one a visitor gets is
  decided by the region your `resolveRegion` reports; an unresolved region is
  never treated as US.
- Global Privacy Control is honored automatically: with `respectGPC` (the
  default) and a visitor in a configured region,
  `navigator.globalPrivacyControl` denies the categories your Consent Mode
  mapping points the three Google ad signals at, marks the state `gpcApplied`,
  and signals Google — with no banner and nothing written to storage. The signal
  is re-read on every page load, so switching it off takes effect immediately.
  An active stored decision takes precedence: a visitor who chose explicitly on
  your site keeps that choice until it expires or is withdrawn.
- A "Do Not Sell or Share" dialog in `@libreconsent/ui`, opened from your own
  link through `usPrivacy.doNotSellSelector` or programmatically through
  `showOptOut()` on either the core API or the mount handle. It is deliberately
  minimal and separate from the consent banner: one action that denies the
  ad-mapped categories, leaves everything else as it was, and persists like any
  other decision. Four new translation keys ship in English and French. A
  selector the browser cannot parse is rejected by `init()` like any other
  invalid configuration, rather than leaving the link quietly inoperative.
- `specs/US_NOTES.md`: the US-4 research record, citing the live Google and
  Global Privacy Control sources with retrieval dates, and explaining why
  libreconsent does not set Google's restricted data processing flags for you
  (they are account- and tag-level settings) with a documented pattern for
  wiring them from a `change` listener if you want them.
- Phase 5 hardening: `blocking.blocklist` installs an opt-in, **best-effort**
  safety net for scripts you cannot author as gates (tag managers, vendor
  scripts that load other scripts). Each entry is
  `{ pattern, category, service? }`, where `pattern` is a plain case-sensitive
  substring of the script's `src` as written — not a regular expression. A
  matching script whose consent is denied has its URL diverted into
  `data-cmp-src` rather than assigned, so the element has no source to fetch,
  and a later grant runs it through the same ordered chain as declarative
  markup.
- `specs/SECURITY_CHECKLIST.md` and `scripts/guardrails.test.mjs`: the security
  and privacy audits that used to be per-phase manual greps now run on every
  CI build, scanning every shipped source file for `eval`, `new Function`,
  markup-injection sinks, any network API, and `__tcfapi` assignment, and
  asserting zero runtime dependencies and no install scripts.
- A layout-shift gate (`tests/hardening.e2e.spec.ts`) proving the banner and
  preferences overlay contribute nothing to Cumulative Layout Shift, plus a
  companion test that displaces real content to prove the measurement works.

### Changed

- `getConfig()` now always reports a `usPrivacy` object, defaulting to
  `{ enabled: false, regions: ["US"], respectGPC: true }`. Existing
  configurations are unaffected: with `enabled` false nothing about their
  behavior changes.
- `ConsentState` gained two never-persisted markers, `implied` and `gpcApplied`,
  and `ready.consent` can now be non-null alongside a `reason` of `new`,
  `expired` or `revision` — `reason` describes what storage held, not what is
  active. Renderers should branch on `ready.consent` rather than `reason` to
  decide whether to ask for a decision.
- `ConsentRenderer` gained an optional `showOptOut()` intent. Existing renderers
  keep satisfying the interface, and the intent stays inert without one.
- The `blocking` configuration object now always reports a `blocklist` array
  from `getConfig()`, defaulting to `[]`. Existing configurations are
  unaffected; an empty blocklist installs nothing at all.
- The published size ceilings were re-baselined once, from measurement rather
  than the pre-code estimate: core **12 kB** gzipped (was 8 kB) and core+ui
  **19 kB** (was 15 kB); the bridge (4 kB) and head snippet (1.5 kB) are
  unchanged. Today's build is well inside them — core 7.96 kB, core+ui
  14.62 kB — and they remain hard CI failures. Nothing about the shipped code
  grew as a result of this change.

### Known limitations

- Bridge discovery is same-window only. Cross-frame locator/proxy support,
  legitimate-interest and vendor-level consent, TC-string decoding, and direct
  service-purpose mapping remain outside Phase 7. GPP detection, parsing,
  emission, and `__gpp` provider behavior are also excluded.
- Under the US opt-out model, third-party tags released by the implied grant
  will set their own cookies before the visitor has decided anything. Nothing of
  libreconsent's reaches storage first, but that is the regime working as
  designed, and it is the substantive difference from the EEA model.
- `analytics_storage` is not denied by a Global Privacy Control opt-out. GPC is
  a do-not-sell-or-share signal rather than a blanket opt-out; map
  `analytics_storage` to a category the opt-out denies if you take a stricter
  view.
- Whether a stored explicit decision may outrank a later GPC signal is a
  judgement call rather than settled law. The reasoning and a
  conflict-notification nuance from CCPA § 7025(c)(3) worth reviewing with
  counsel are documented in `specs/US_NOTES.md`.
- No IAB GPP or US Privacy string is emitted. Google receives GPC directly and
  applies restricted data processing itself in applicable states; a site that
  needs Google Ad Manager to see the opt-out through a string needs something
  else in front of its ad tags.
- Real GPC-enabled browsers are not exercised in CI. Playwright has no native
  GPC context option, so the end-to-end tests simulate the signal with a
  `Sec-GPC` header and an injected `navigator.globalPrivacyControl`.
- The BLK-4 net is explicitly **not** a guarantee, and the declarative markup
  remains the guaranteed path. Interception has to happen before a script
  enters the document — once a `<script src>` is inserted the browser has
  already started fetching it, and neither detaching it nor changing its type
  cancels execution.
- **Only `<script src>` is intercepted.** A pattern has no effect on image
  pixels, `fetch`, `sendBeacon`, `<iframe>`, preloads, Workers or dynamic
  `import()`. Also uncovered: parser-inserted scripts, `document.write()` (even
  when a vendor calls it at runtime), dynamically injected *inline* scripts, and
  code that goes around the patched entry points.
- Enabling a blocklist patches the `src` setter and `setAttribute` on
  `HTMLScriptElement.prototype`. This is a deliberate global side effect: it is
  installed only when at least one pattern is configured, affects no other
  element type, is reverted by `reset()`, and will not uninstall another
  library's later patch.
- `reloadOnWithdraw` does not cover a blocklisted script that loaded because
  consent was already granted when it was injected; such a script is never
  tracked as a gate.

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

- Listener teardown now retains the CMP that owns the first successfully
  confirmed numeric listener ID. A later unrelated `window.__tcfapi`
  replacement can no longer receive or collide with that provider-local ID,
  while queued-stub handoff still binds ownership to the live CMP at
  confirmation time.
- TCF readiness now requires a successful `addEventListener` callback before
  the absolute discovery deadline. A silent queued stub no longer publishes
  irreversible `source: "tcf"` readiness, asynchronous registration rejection
  resumes bounded discovery, and a late success confirmation is removed rather
  than displacing the configured `none` / fallback handoff.
- A delayed polling task now checks the absolute discovery deadline before
  accepting a newly visible CMP, so a provider installed only after timeout
  cannot suppress the required `none` / fallback result.
- A CMP that synchronously rejects TCF listener registration no longer leaves
  the bridge permanently ready with `source: "tcf"` and no listener. Discovery
  keeps polling until another provider accepts registration or the configured
  timeout activates the normal `none` / fallback path.
- Synchronous fallback event replay is now held until all three forwarding
  subscriptions are installed and removable. If later setup fails, every
  established subscription is cleaned up, staged events are discarded, and the
  bridge fails closed to `source: "none"` instead of exposing stale fallback
  readiness or consent.
- Bridge teardown now removes an external listener through the currently active
  same-window `__tcfapi` provider. This covers the standard queued-stub handoff
  where the real CMP replaces the stub before returning the listener ID; reset
  and late post-reset callbacks no longer strand listeners on the replacement
  CMP.
- Each consent layer now releases exactly its own focus trap. Opening
  preferences over a `modal`-layout banner previously overwrote the banner's
  release function, leaking its `keydown` listener, and a decision taken in the
  second layer then released the preferences trap in the banner's place.
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
