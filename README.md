# libreconsent

[![CI](https://github.com/nicolasestrem/libreconsent/actions/workflows/ci.yml/badge.svg)](https://github.com/nicolasestrem/libreconsent/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@libreconsent/core)](https://www.npmjs.com/package/@libreconsent/core)
[![core size](https://img.shields.io/badge/core-under%2012%20kB%20gzipped-blue)](.size-limit.cjs)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Consent-mode-first, self-hosted consent infrastructure. A GDPR/ePrivacy and
US-state consent manager that blocks tags before a decision, speaks Google
Consent Mode v2 as a first-class concern, ships zero third-party runtime
dependencies, and makes no network request of its own.

| Package | Purpose |
|---|---|
| [`@libreconsent/core`](packages/core/README.md) | Consent lifecycle, Consent Mode v2, declarative gates, US opt-out, optional receipt delivery |
| [`@libreconsent/ui`](packages/ui/README.md) | Shadow-DOM banner, preferences, re-entry, and Do-Not-Sell UI |
| [`@libreconsent/bridge`](packages/bridge/README.md) | UI-less, storage-free, read-only observation of an external TCF CMP |
| [`@libreconsent/worker-log`](packages/worker-log/README.md) | Optional Cloudflare Worker and D1 receipt trail |

## Why

Most "free" CMPs are freemium products shaped by certification economics.
Publishers serving Google ads to visitors in the EEA, UK, or Switzerland must
use a Google-certified CMP integrated with IAB TCF. Registration in that
framework costs roughly €1,350–1,500 a year with annual recertification, and
the TC string embeds a CMP ID validated against the paid registry. IAB holds
the registered CMP-ID owner responsible for the behavior of every deployment,
which is structurally incompatible with software anyone may fork and
self-host. That is why no open-source CMP holds certification, and why the
open-source options tend to be lead generators for a hosted tier.

libreconsent does not try to be that certified banner and never will. It
covers everything else: prior blocking, granular categories, an
equal-prominence reject action, withdrawal, expiry, Google Consent Mode v2
signaling for GA4/Ads/GTM, and the US opt-out model with Global Privacy
Control. On the domains that genuinely require certified TCF consent, Google
already ships a free certified banner of its own (Privacy & messaging);
`@libreconsent/bridge` reads it read-only so one application API covers a
mixed portfolio. The reasoning is recorded in
[specs/NO_TCF.md](specs/NO_TCF.md).

## Install

All four packages are published on npm at `1.0.0` under MIT.

```sh
pnpm add @libreconsent/core @libreconsent/ui
```

### ESM

```ts
import { init } from "@libreconsent/core";
import { mount } from "@libreconsent/ui";

const api = init({
  categories: [
    {
      id: "analytics",
      label: "category.analytics.label",
      description: "category.analytics.description",
    },
    {
      id: "marketing",
      label: "category.marketing.label",
      description: "category.marketing.description",
    },
  ],
  i18n: {
    translations: {
      en: {
        "category.analytics.label": "Analytics",
        "category.analytics.description": "Measures use of this site.",
        "category.marketing.label": "Marketing",
        "category.marketing.description": "Supports personalized advertising.",
      },
    },
  },
});

mount(api);
```

### Self-hosted browser artifacts

Copy the files from installed packages to your own origin; no CDN is required:

```html
<script src="/vendor/libreconsent/core/index.global.js"></script>
<script src="/vendor/libreconsent/ui/index.global.js"></script>
<script>
  const api = LibreConsentCore.init({ /* configuration */ });
  LibreConsentUi.mount(api);
</script>
```

The stable v1 browser artifacts are:

- core: `dist/index.global.js` → `LibreConsentCore`
- UI: `dist/index.global.js` → `LibreConsentUi`
- bridge: `dist/index.global.js` → `LibreConsentBridge`
- synchronous Consent Mode head bootstrap:
  `@libreconsent/core/dist/head-snippet.global.js`

Only package-root ESM and TypeScript imports are public semver API. Deep module
imports are unsupported and blocked by package export maps. The named IIFE and
head-snippet files above are stable self-hosted artifacts for the v1 line, but
they are copied as files rather than imported as package subpaths.

### From source

Building from a checkout is for contributors and for anyone reproducing the
published artifacts:

```sh
pnpm install
pnpm build
pnpm examples:serve
```

## Four tested quickstarts

- [Basic Consent Mode](examples/quickstarts/basic-consent-mode/index.html):
  analytics-only consent: the analytics loader is declaratively gated while all
  advertising Consent Mode signals remain fixed denied.
- [GTM basic mode](examples/quickstarts/gtm-basic-mode/index.html): defaults
  precede the container initialization marker; the loader remains gated.
- [AdSense / Google Privacy & messaging bridge](examples/quickstarts/adsense-bridge/index.html):
  read-only external-CMP observation. It never provides `__tcfapi`, never
  replaces Google's banner, and never makes libreconsent a certified CMP.
- [US-only opt-out](examples/quickstarts/us-only-opt-out/index.html): a real
  same-origin region resolver, GPC, implied grant, and Do-Not-Sell entry point.

The quickstarts use local stand-ins for vendor loaders so automated tests make
no third-party requests. Replace only the clearly marked local loader URLs in
your deployment.

To copy one, keep its complete `quickstarts/<name>/` directory and copy the
shared `examples/vendor/libreconsent/` directory beside it. The pages load
those exact browser files through relative URLs, so an ordinary static server
needs no aliases, rewrites, repository preprocessing, or Cloudflare-specific
routing.

The three Consent Mode pages already contain the complete inline head
bootstrap. The US example intentionally keeps `/api/region` as a deployment
endpoint; on a static-only host its 404 resolves to `null` and the example
fails closed.

The [local demo](examples/demo-site/index.html) demonstrates accept, reject,
customize, gated local content, withdrawal, re-entry, and the current state
without contacting any vendor.

[examples/README.md](examples/README.md) describes every directory under
`examples/`, including which ones are Playwright fixtures rather than starting
points to copy.

## Google implementation sources

The Google-specific quickstarts were rechecked on **2026-07-29** against:

- [Set up consent mode on websites](https://developers.google.com/tag-platform/security/guides/consent):
  defaults precede commands that send measurement data; later choices update
  consent.
- [Create a consent mode template](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis):
  GTM consent templates use Consent Initialization - All Pages and the
  template consent APIs.
- [The data layer](https://developers.google.com/tag-platform/tag-manager/datalayer):
  current container initialization ordering.
- [Google consent requirements for AdSense publishers](https://support.google.com/adsense/answer/13554116?hl=en)
  and [Google CMP overview](https://support.google.com/adsense/answer/16918505?hl=en):
  personalized ads in the EEA, UK, and Switzerland require a Google-certified
  TCF CMP.
- [US-state privacy guidance for Google Ads](https://support.google.com/google-ads/answer/9614122?hl=en)
  and [publishers](https://support.google.com/admanager/answer/9561023?hl=en):
  GPC and restricted-data-processing behavior remains product-specific.

## Privacy, security, and legal boundaries

- No telemetry, phone-home request, CDN, or external asset is built into core,
  UI, or bridge.
- Nothing is persisted before an explicit decision. US implied grant and GPC
  state remain in memory and are recomputed on every load.
- Declarative gates are the guaranteed prior-blocking path. Dynamic script
  interception is a documented best-effort safety net.
- The bridge is fixture-tested but has **not** been validated on a real AdSense
  domain using Google Privacy & messaging. No production-interoperability claim
  is made.
- libreconsent does not provide TCF or GPP strings and can never act as the
  certified AdSense CMP for EEA/UK/Swiss personalized-ad traffic.
- Default EN/FR text and configuration examples are engineering starting
  points, not legal advice. Site owners remain responsible for notices,
  category mapping, lawful basis, retention, vendors, and jurisdictional
  review.

## Browser support

The target is the last two evergreen Chrome, Edge, and Firefox releases plus
Safari 15.4 and newer, with no legacy bundle. Chromium is the only automated
browser smoke; Firefox and Safari compatibility are checked when the project
has real adoption pressure.

## Specification

The requirement-level specification, its traceability matrix, and the accepted
limitations are tracked in
[specs/03_MASTER_PRODUCTION_SPEC.md](specs/03_MASTER_PRODUCTION_SPEC.md),
[specs/TRACEABILITY.md](specs/TRACEABILITY.md), and
[specs/07_KNOWN_GAPS.md](specs/07_KNOWN_GAPS.md). The global guardrails
G-1..G-6 that every change is held to live in the production specification.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers the local gates, the coding
conventions, and the chores that are easy to forget — notably refreshing the
mirrored quickstart assets after a browser artifact changes. Releases follow
[RELEASING.md](RELEASING.md).

## Security

Report a suspected vulnerability privately as described in
[SECURITY.md](SECURITY.md) rather than in a public issue.

## License

MIT. See [LICENSE](LICENSE).
