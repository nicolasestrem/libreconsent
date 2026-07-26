# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 3 status

`@libreconsent/core` now implements validated configuration, consent state and
lifecycle events, region resolution, first-party cookie/localStorage
persistence, Google Consent Mode v2 defaults/updates, and declarative script and
embed blocking. The flagship pre-consent network-silence suite passes against
real `gtag.js` in basic mode: the example gates the loader declaratively, so no
Google-owned request is made before a decision. The UI, bridge, and optional
Worker receipt service remain later phases. TCF support is intentionally and
permanently excluded.

Dynamically injected scripts are not intercepted yet; the guaranteed path is
declarative markup, documented in
[`packages/core/README.md`](packages/core/README.md#blocking).

The next product phase is Phase 4 — the UI: consent banner and preferences
modal. Completed requirements and their verification evidence are tracked in
[`specs/TRACEABILITY.md`](specs/TRACEABILITY.md) and enforced in CI.

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
