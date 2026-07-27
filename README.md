# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 4 status

`@libreconsent/core` implements validated configuration, consent state and
lifecycle events, region resolution, first-party cookie/localStorage
persistence, Google Consent Mode v2 defaults/updates, and declarative script and
embed blocking. The flagship pre-consent network-silence suite passes against
real `gtag.js` in basic mode: the example gates the loader declaratively, so no
Google-owned request is made before a decision.

[`@libreconsent/ui`](packages/ui/README.md) now renders the consent banner and
preferences modal in a shadow root, themed entirely through
`--libreconsent-*` custom properties, with English and French dictionaries.
Accept and reject are equally prominent by construction, nothing optional is
pre-checked, and both layers pass axe-core with zero critical or serious
violations in light and dark themes. Keyboard-only accept and reject journeys
are enforced in CI.

The bridge and the optional Worker receipt service remain later phases. TCF
support is intentionally and permanently excluded.

Dynamically injected scripts are not intercepted yet; the guaranteed path is
declarative markup, documented in
[`packages/core/README.md`](packages/core/README.md#blocking).

The next product phase is Phase 5 — hardening: the best-effort MutationObserver
net and the size, CSP, security and CLS audits. Completed requirements and their
verification evidence are tracked in
[`specs/TRACEABILITY.md`](specs/TRACEABILITY.md) and enforced in CI.

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
