# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 5 status

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

Dynamically injected scripts are covered by an opt-in **best-effort** safety net
that marks a matching script inert before it can be fetched. It is explicitly not
a guarantee — parser-inserted and dynamically injected inline scripts cannot be
intercepted — so the guaranteed path remains declarative markup. Both are
documented in
[`packages/core/README.md`](packages/core/README.md#dynamic-injection-safety-net).

The non-functional gates now run on real code in CI: size budgets against the
built artifacts, a prohibited-construct and zero-dependency scan over every
shipped source file, a CSP fixture proving nonce propagation, and a
layout-shift check proving the banner displaces no content. Completed
requirements and their verification evidence are tracked in
[`specs/TRACEABILITY.md`](specs/TRACEABILITY.md) and enforced in CI.

The next product phase is Phase 6 — the US state-privacy module (GPC
auto-opt-out and the Do-Not-Sell dialog).

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
