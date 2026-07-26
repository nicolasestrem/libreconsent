# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 2 status

`@libreconsent/core` now implements validated configuration, consent state and
lifecycle events, region resolution, first-party cookie/localStorage
persistence, and Google Consent Mode v2 defaults/updates. The UI, bridge,
declarative blocking, and optional Worker receipt service remain later phases.
TCF support is intentionally and permanently excluded.

The next product phase is declarative script and embed blocking. Completed
requirements and their verification evidence are tracked in
[`specs/TRACEABILITY.md`](specs/TRACEABILITY.md) and enforced in CI.

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
