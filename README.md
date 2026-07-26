# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 1 status

`@libreconsent/core` now implements validated configuration, consent state and
lifecycle events, region resolution, and first-party cookie/localStorage
persistence. The UI, bridge, and optional Worker receipt service remain typed
stubs for their later phases. TCF support is intentionally and permanently
excluded.

The next product phase is Google Consent Mode v2. Completed requirements and
their verification evidence are tracked in
[`specs/TRACEABILITY.md`](specs/TRACEABILITY.md) and enforced in CI.

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
