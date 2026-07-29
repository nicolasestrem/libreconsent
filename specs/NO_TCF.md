# No TCF support

libreconsent deliberately does not implement IAB Europe TCF. It never emits a TC string, provides a `__tcfapi`, or claims a CMP ID.

## Why

For publishers serving Google ads in the EEA, UK, or Switzerland, Google requires a certified CMP integrated with IAB TCF. A valid TC string includes a CMP ID from the paid registry; certification and recurring recertification place deployment responsibility on that registered CMP owner. Those obligations are incompatible with a freely forkable, self-hosted library that cannot issue or inherit a certified CMP identity.

Use Google Privacy & messaging for AdSense, Ad Manager, or AdMob sites that require certified TCF consent. It can be the single Google-certified banner on those domains. libreconsent is intended for no-ads, non-EEA-ad, and non-Google-consent use cases.

## Bridge exception

`@libreconsent/bridge` reads an external CMP's `__tcfapi` to expose a consistent, read-only application API. It never provides that API, writes external CMP storage, emits TC strings, or sends consent signals.

See [Project Context §1–4](01_PROJECT_CONTEXT.md) and guardrail G-1 in [the master production spec §13](03_MASTER_PRODUCTION_SPEC.md).
