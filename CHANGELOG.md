# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

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

### Added

- Google Consent Mode v2 head defaults, lifecycle-driven four-signal updates,
  regional defaults, and compiled-fixture ordering coverage.

### Fixed

- Traceability verification evidence must reference a configured
  unit/E2E/accessibility test or a supported named CI gate.
