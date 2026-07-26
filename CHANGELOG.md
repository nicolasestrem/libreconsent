# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

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

- An omitted `enabled` value in the standalone Consent Mode head configuration
  now remains side-effect-free, matching the public configuration default.
- Traceability verification evidence must reference a configured
  unit/E2E/accessibility test or a supported named CI gate.
