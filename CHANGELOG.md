# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Phase 1 `@libreconsent/core` configuration validation and normalization,
  consent state lifecycle, replayable events, queued decisions, region
  resolution, and cookie/localStorage persistence.
- Public core configuration, consent, event, selection, cookie-disclosure, and
  typed error contracts, with English and French reference dictionaries.
- Core lifecycle, storage, region, revision-prefill, and invariant unit
  coverage plus Phase 1 API and Cloudflare region-resolver documentation.
- Cross-platform Vitest startup for real jsdom Web Storage on Node 24+ and
  repository-wide LF normalization for deterministic Biome checks.
- Phase 0 pnpm monorepo scaffold with typed package stubs, CI gates, examples, and test tooling.
