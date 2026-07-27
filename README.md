# libreconsent

Consent-mode-first, self-hosted consent infrastructure.

## Phase 7 status

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

The US state-privacy module lets one configuration serve both regimes. Where
`usPrivacy` applies, an undecided visitor sees no banner and optional categories
behave as granted until they opt out, which is what US state law asks for and
the opposite of the EEA default; the resolved region decides which regime a
visitor gets. A `navigator.globalPrivacyControl` signal automatically denies the
categories the Google ad signals map to, and a "Do Not Sell or Share" link opens
a minimal opt-out dialog. Neither the implied grant nor the GPC opt-out is ever
written to storage: the signal is re-read on every page load, so nothing of ours
reaches the browser before an actual decision. Details and the researched Google
sources are in [`packages/core/README.md`](packages/core/README.md#us-state-privacy)
and [`specs/US_NOTES.md`](specs/US_NOTES.md).

Phase 7 adds [`@libreconsent/bridge`](packages/bridge/README.md), a UI-less,
read-only adapter for domains where an external CMP owns consent. It observes a
same-window TCF v2 API, maps purpose consent to libreconsent categories, and
exposes familiar `ready` / `consent` / `change` events without providing
`__tcfapi`, exposing TC strings, rendering UI, persisting data, or emitting
Google signals. If no CMP appears before the configured deadline, it can either
report `source: "none"` or hand off once to an injected full libreconsent
fallback. The bridge unit/browser suites, 4 kB size gate, and permanent
no-provider guardrail are green after the queued-CMP teardown follow-up. TCF and
GPP provider support are intentionally excluded; the bridge does not consume
GPP either.

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

The next product phase is Phase 8 — the optional Worker receipt service.

## Development

```sh
pnpm install
pnpm check
```

See [the production specification](specs/03_MASTER_PRODUCTION_SPEC.md) for the phased build plan.
